#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
r"""controlroom_bridge.py — read-only JSON bridge to the canonical lock/permission logic.

This script owns NO lock semantics of its own. Every decision about what counts as a
lock, whether a lock has expired, which lock types never expire, and how permission
rules are ranked is delegated to the canonical host modules:

    lock_utils.py     lock file format, scope parsing, expiry, protected lock types
    permissions.py    LOCK.permissions.json parsing and `evaluate` (deny > ask > allow)
    lock_scan.py      root configuration and full-tree collection

Those modules are imported from the directory passed via --scripts-dir. They are read,
never written and never modified. Keeping them as the single source of truth is the
entire point of this file: a second implementation of the lock rules would drift.

What this bridge adds is only *composition* the canonical CLI does not offer:

  * `check-lock` walks a path upwards through its ancestors, because a lock in a parent
    directory locks everything beneath it. `lock_scan.py` has no path-scoped query.
  * `evaluate-permission` finds the nearest ancestor carrying a permission register.
  * `list-locks` scans the configured roots under a wall-clock budget and reports
    honestly when the budget ran out (a full scan takes minutes over cloud storage).
  * `list-decisions` reads the generated decision index and reports its staleness.
  * `list-governance` combines that decision projection with allowlisted metadata
    loaded through the canonical ``PolicyRegistry.load()`` API and the existing
    ``ellmos.plans-register/1`` strategic-plan index.
  * `list-resources`/`describe-resource` read `.SYNC/_inventory/inventory.db` directly (no
    canonical CLI exists for it -- it is plain schema data, not embedded business logic like
    the modules above). Register authority sits with the ControlRoom programme's own
    resolver role (`resources.inventory` in source-resolver); this bridge is a read-only
    mirror of the same file, never a second canon.

Fail-closed contract: every command that cannot determine an answer emits
`"verdict": "unknown"` (or the command's equivalent) and never a reassuring default.

Output: a single JSON object on stdout. Diagnostics go to stderr.

Usage:
    python controlroom_bridge.py --scripts-dir DIR check-lock PATH
    python controlroom_bridge.py --scripts-dir DIR list-locks [--roots-file F] [--budget-seconds N]
    python controlroom_bridge.py --scripts-dir DIR evaluate-permission PATH AGENT ACTION
    python controlroom_bridge.py --decisions-root DIR list-decisions [--status S] [--limit N]
    python controlroom_bridge.py --decisions-root DIR --policy-registry FILE --plans-register FILE list-governance
    python controlroom_bridge.py --inventory-db FILE list-resources [--type systems|software|all] [--host H] [--limit N]
    python controlroom_bridge.py --inventory-db FILE describe-resource ID [--type systems|software]
"""
from __future__ import annotations

import argparse
import importlib
import json
import sqlite3
import sys
import time
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace

SCHEMA = "controlcenter.controlroom/1"

# Decision index fields that are safe to surface. The index also carries the question
# text, option and recommendation excerpts, the raw decision field and absolute source
# paths. Those can describe personal circumstances, so they are deliberately dropped
# here rather than filtered later — the bridge never emits what it never reads out.
DECISION_PUBLIC_FIELDS = ("key", "id", "date", "title", "status", "scope", "source_file")
GOVERNANCE_DECISION_FIELDS = ("key", "id", "date", "title", "status", "scope")
GOVERNANCE_NORM_KINDS = {"policy", "rule", "decision"}
PLANS_SCHEMA = "ellmos.plans-register/1"
BYUM_PROTOCOL = "byum.decision-prediction.v2"
BYUM_PROJECTION_STATUSES = {"pending", "decision-observed", "validated"}


class BridgeError(Exception):
    """Raised for conditions that must surface as a fail-closed result, not a crash."""


def _load_canonical(scripts_dir: Path):
    """Import the canonical lock modules from the host's script directory."""
    if not scripts_dir.is_dir():
        raise BridgeError(f"scripts directory not found: {scripts_dir}")
    missing = [n for n in ("lock_utils.py", "permissions.py") if not (scripts_dir / n).is_file()]
    if missing:
        raise BridgeError(
            f"canonical modules missing in {scripts_dir}: {', '.join(missing)}"
        )
    sys.path.insert(0, str(scripts_dir))
    try:
        import lock_utils  # noqa: PLC0415
        import permissions  # noqa: PLC0415
    except ImportError as exc:  # pragma: no cover - defensive
        raise BridgeError(f"cannot import canonical modules: {exc}") from exc
    return lock_utils, permissions


def _load_scan(scripts_dir: Path):
    if not (scripts_dir / "lock_scan.py").is_file():
        raise BridgeError(f"lock_scan.py missing in {scripts_dir}")
    sys.path.insert(0, str(scripts_dir))
    try:
        import lock_scan  # noqa: PLC0415
    except ImportError as exc:  # pragma: no cover - defensive
        raise BridgeError(f"cannot import lock_scan: {exc}") from exc
    return lock_scan


def _ancestors(target: Path) -> list[Path]:
    """The directory itself (or the file's directory) plus every parent, nearest first."""
    start = target if target.is_dir() else target.parent
    chain = [start]
    current = start
    while current.parent != current:
        current = current.parent
        chain.append(current)
    return chain


def _describe_lock(lock_utils, lock_path: Path, scope: str, is_legacy: bool,
                   directory: Path, distance: int) -> dict:
    """Render one lock using only canonical accessors."""
    data = lock_utils.parse_lock_file(lock_path)
    lock_type = lock_utils.lock_type_from_name(lock_path.name)
    operations = lock_utils.locked_operations(lock_path)
    return {
        "path": str(lock_path),
        "directory": str(directory),
        "distance": distance,          # 0 = the path itself, 1 = parent, ...
        "inherited": distance > 0,     # a parent lock locks everything beneath it
        "scope": scope,
        "lock_type": lock_type,
        "legacy": is_legacy,
        "protected": lock_utils.is_protected_lock(lock_path.name),
        "owner": data.get("owner", ""),
        "host": lock_utils.lock_host(lock_path),
        "created": data.get("created", ""),
        "purpose": data.get("purpose", ""),
        "mode": data.get("mode", ""),
        "release_condition": data.get("release_condition", ""),
        "restricted_operations": operations,
        "expires_at": lock_utils.compute_expires_at(lock_path),
    }


def cmd_check_lock(args) -> dict:
    """Is this path locked, counting locks inherited from any parent directory?"""
    lock_utils, _ = _load_canonical(Path(args.scripts_dir))
    target = Path(args.path)

    if not target.exists():
        # An unreadable or absent path cannot be cleared. Saying "free" here would be
        # exactly the dangerous answer this tool exists to avoid.
        return {
            "schema": SCHEMA,
            "command": "check-lock",
            "path": str(target),
            "verdict": "unknown",
            "safe_to_proceed": False,
            "reason": "path does not exist or is not readable",
            "locks": [],
        }

    found: list[dict] = []
    errors: list[str] = []
    for distance, directory in enumerate(_ancestors(target)):
        try:
            active = lock_utils.active_locks(directory)
        except OSError as exc:
            errors.append(f"{directory}: {exc}")
            continue
        for name, scope, is_legacy in active:
            found.append(
                _describe_lock(lock_utils, directory / name, scope, is_legacy, directory, distance)
            )

    if errors:
        # Part of the ancestor chain could not be read, so absence of a lock is not
        # proof of absence. Fail closed.
        return {
            "schema": SCHEMA,
            "command": "check-lock",
            "path": str(target),
            "verdict": "unknown",
            "safe_to_proceed": False,
            "reason": "part of the ancestor chain could not be read",
            "errors": errors,
            "locks": found,
        }

    verdict = "locked" if found else "clear"
    return {
        "schema": SCHEMA,
        "command": "check-lock",
        "path": str(target),
        "verdict": verdict,
        "safe_to_proceed": verdict == "clear",
        "lock_count": len(found),
        "locks": found,
    }


def cmd_list_locks(args) -> dict:
    """All active locks across the configured roots, under a wall-clock budget."""
    scripts_dir = Path(args.scripts_dir)
    lock_scan = _load_scan(scripts_dir)
    roots_file = Path(args.roots_file) if args.roots_file else scripts_dir / "lock_roots.json"
    if not roots_file.is_file():
        raise BridgeError(f"roots file not found: {roots_file}")

    try:
        config = lock_scan.load_config(roots_file)
    except (OSError, ValueError) as exc:
        raise BridgeError(f"cannot read roots file {roots_file}: {exc}") from exc

    roots = config.get("roots", [])
    budget = float(args.budget_seconds)
    started = time.monotonic()

    locks: list[dict] = []
    scanned: list[str] = []
    skipped: list[str] = []

    for entry in roots:
        if time.monotonic() - started >= budget:
            skipped.append(entry.get("path", "?"))
            continue
        single = dict(config)
        single["roots"] = [entry]
        try:
            locks.extend(lock_scan.collect_locks(single))
            scanned.append(entry.get("path", "?"))
        except OSError as exc:
            skipped.append(f"{entry.get('path', '?')} ({exc})")

    complete = not skipped
    locks.sort(key=lambda r: r.get("path", ""))
    return {
        "schema": SCHEMA,
        "command": "list-locks",
        "roots_file": str(roots_file),
        # A partial scan proves nothing about the roots it never reached, so the
        # result is explicitly marked incomplete rather than presented as the truth.
        "complete": complete,
        "verdict": "complete" if complete else "partial",
        "elapsed_seconds": round(time.monotonic() - started, 2),
        "budget_seconds": budget,
        "scanned_roots": scanned,
        "skipped_roots": skipped,
        "lock_count": len(locks),
        "locks": locks,
    }


def cmd_evaluate_permission(args) -> dict:
    """What may this agent do here, per the nearest LOCK.permissions register?"""
    lock_utils, permissions = _load_canonical(Path(args.scripts_dir))
    target = Path(args.path)

    if not target.exists():
        return {
            "schema": SCHEMA,
            "command": "evaluate-permission",
            "path": str(target),
            "agent": args.agent,
            "action": args.action,
            "verdict": "unknown",
            "decision": "unknown",
            "reason": "path does not exist or is not readable",
        }

    register_dir: Path | None = None
    register_path: Path | None = None
    for directory in _ancestors(target):
        for name in permissions.PERMISSIONS_FILENAMES:
            candidate = directory / name
            if candidate.is_file():
                register_dir, register_path = directory, candidate
                break
        if register_dir is not None:
            break

    if register_dir is None:
        # No register anywhere up the chain. That is not a permission to act — this
        # tool only reports what a register says, and here none said anything.
        return {
            "schema": SCHEMA,
            "command": "evaluate-permission",
            "path": str(target),
            "agent": args.agent,
            "action": args.action,
            "verdict": "unknown",
            "decision": "unknown",
            "reason": "no LOCK.permissions register found in this path or any parent",
            "register": None,
        }

    perm = permissions.load_permissions(register_dir)
    if perm is None:
        return {
            "schema": SCHEMA,
            "command": "evaluate-permission",
            "path": str(target),
            "agent": args.agent,
            "action": args.action,
            "verdict": "unknown",
            "decision": "unknown",
            "reason": "permission register found but unreadable or not valid JSON",
            "register": str(register_path),
        }

    decision = permissions.evaluate(perm, args.agent, args.action)
    return {
        "schema": SCHEMA,
        "command": "evaluate-permission",
        "path": str(target),
        "agent": args.agent,
        "action": args.action,
        # Precedence deny > ask > allow > default is decided by permissions.evaluate.
        "verdict": decision,
        "decision": decision,
        "register": str(register_path),
        "register_directory": str(register_dir),
        "applies_to_agent": permissions.applies_to(perm, args.agent),
        "register_default": perm.get("default", "allow"),
    }


def _decision_chain_files(root: Path) -> list[Path]:
    out: list[Path] = []
    for pattern in ("TO-DECIDE-USER.txt", "TO-DECIDE-USER_*.txt", "TO-DECIDE-USER-*.txt"):
        out.extend(sorted(root.glob(pattern)))
    done = root / "DECIDED-AND-DONE.md"
    if done.is_file():
        out.append(done)
    return out


def cmd_list_decisions(args) -> dict:
    """Open user decisions, from the generated index, with staleness reported."""
    root = Path(args.decisions_root)
    if not root.is_dir():
        raise BridgeError(f"decisions root not found: {root}")

    index_path = root / "_tools" / "decisions.index.json"
    if not index_path.is_file():
        # No index is not the same as no open decisions. Never imply the latter.
        return {
            "schema": SCHEMA,
            "command": "list-decisions",
            "verdict": "unavailable",
            "reason": f"decision index not found at {index_path}; "
                      "run decisions_index.py on the host to generate it",
            "decisions": [],
        }

    try:
        index = json.loads(index_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        return {
            "schema": SCHEMA,
            "command": "list-decisions",
            "verdict": "unavailable",
            "reason": f"decision index unreadable: {exc}",
            "decisions": [],
        }

    generated_at = index.get("generated_at", "")
    stale_sources: list[str] = []
    try:
        index_mtime = index_path.stat().st_mtime
        for source in _decision_chain_files(root):
            if source.stat().st_mtime > index_mtime:
                stale_sources.append(source.name)
    except OSError:
        stale_sources.append("<staleness check failed>")

    wanted = (args.status or "OFFEN").upper()
    entries = index.get("entries") or []
    if wanted != "ALL":
        entries = [e for e in entries if str(e.get("status_class", "")).upper() == wanted]

    projected = []
    for entry in entries[: args.limit]:
        row = {
            "key": entry.get("key", ""),
            "id": entry.get("id", ""),
            "date": entry.get("date", ""),
            "title": entry.get("title", ""),
            "status": entry.get("status_class", ""),
            "scope": entry.get("scope", ""),
            "source_file": entry.get("source_file", ""),
        }
        projected.append({k: row[k] for k in DECISION_PUBLIC_FIELDS if k in row})

    return {
        "schema": SCHEMA,
        "command": "list-decisions",
        "verdict": "stale" if stale_sources else "ok",
        "index_generated_at": generated_at,
        # The index is a generated artefact. If a chain file changed after it was
        # written, the list below may be missing entries — say so rather than imply
        # completeness.
        "stale": bool(stale_sources),
        "stale_sources": stale_sources,
        "status_filter": wanted,
        "match_count": len(entries),
        "returned": len(projected),
        "counts_by_status": (index.get("counts") or {}).get("by_status_class", {}),
        "decisions": projected,
    }


def _scalar_text(value: object) -> str:
    if not isinstance(value, str):
        raise BridgeError("projected metadata must be scalar text")
    return value.strip()


def _governance_decisions(args) -> tuple[dict, list[dict]]:
    if not args.decisions_root:
        return {"status": "unconfigured"}, []
    try:
        result = cmd_list_decisions(SimpleNamespace(
            decisions_root=args.decisions_root,
            status=args.status,
            limit=args.decision_limit,
        ))
    except BridgeError:
        return {"status": "unreadable", "reason_code": "decision_register_unreadable"}, []
    except (AttributeError, TypeError):
        return {"status": "invalid", "reason_code": "decision_index_validation_failed"}, []
    if result.get("verdict") not in {"ok", "stale"}:
        return {"status": "unreadable", "reason_code": "decision_index_unreadable"}, []
    try:
        projected = [
            {field: _scalar_text(entry.get(field, "")) for field in GOVERNANCE_DECISION_FIELDS}
            for entry in result.get("decisions", [])
        ]
    except (BridgeError, AttributeError):
        return {"status": "invalid", "reason_code": "decision_projection_validation_failed"}, []
    return {
        "status": "available",
        "stale": bool(result.get("stale")),
        "stale_source_count": len(result.get("stale_sources", [])),
        "match_count": result.get("match_count", len(projected)),
        "returned": len(projected),
    }, projected


def _hash_status(entry: dict) -> str:
    value = entry.get("hash")
    if isinstance(value, dict) and value.get("algorithm") == "sha256" and value.get("value"):
        return "sha256"
    return "missing"


def _required_text(value: object) -> str:
    value = _scalar_text(value)
    if not value:
        raise BridgeError("required projected metadata is invalid")
    return value


def _optional_text(value: object) -> str | None:
    if value is None:
        return None
    return _required_text(value)


def _project_norm(entry: dict) -> dict:
    return {
        "id": _required_text(entry.get("id")),
        "kind": _required_text(entry.get("kind")),
        "title": _required_text(entry.get("title")),
        "scope": _required_text(entry.get("scope")),
        "status": _required_text(entry.get("status")),
        "adoption": _required_text(entry.get("adoption")),
        "authority": _optional_text(entry.get("authority")),
        "privacy": _required_text(entry.get("privacy")),
        "hash_status": _hash_status(entry),
    }


def _required_sha256(value: object) -> str:
    value = _required_text(value)
    if len(value) != 64 or any(char not in "0123456789abcdef" for char in value):
        raise BridgeError("candidate hash is invalid")
    return value


def _project_byum_candidate(entry: dict) -> dict:
    source = entry.get("source")
    provenance = entry.get("provenance")
    if not isinstance(source, dict) or not isinstance(provenance, dict):
        raise BridgeError("candidate source or provenance is invalid")
    if (
        entry.get("kind") != "decision-candidate"
        or entry.get("adoption") != "pending"
        or entry.get("authority") != "advisory-pointer"
        or source.get("type") != "byum-projection"
        or provenance.get("protocol") != BYUM_PROTOCOL
    ):
        raise BridgeError("BYUM candidate authority boundary is invalid")
    decision_ref = provenance.get("decision_ref")
    if not isinstance(decision_ref, dict):
        raise BridgeError("candidate decision_ref is invalid")
    locator = decision_ref.get("source_locator")
    if not isinstance(locator, dict):
        raise BridgeError("candidate source locator is invalid")
    projection_status = provenance.get("projection_status")
    if projection_status not in BYUM_PROJECTION_STATUSES:
        raise BridgeError("candidate projection status is invalid")
    hash_value = entry.get("hash")
    if not isinstance(hash_value, dict) or hash_value.get("algorithm") != "sha256":
        raise BridgeError("candidate projection hash is invalid")

    return {
        **_project_norm(entry),
        "protocol": BYUM_PROTOCOL,
        "prediction_id": _required_text(provenance.get("prediction_id")),
        "decision_ref": {
            "decision_id": _required_text(decision_ref.get("decision_id")),
            "index_key": _required_text(decision_ref.get("index_key")),
            "scope": _required_text(decision_ref.get("scope")),
            "block_id": _required_text(locator.get("block_id")),
            "source_sha256": _required_sha256(decision_ref.get("source_sha256")),
        },
        "projection_status": projection_status,
        "projection_sha256": _required_sha256(hash_value.get("value")),
    }


def _governance_registry(args) -> tuple[dict, list[dict], list[dict]]:
    if not args.policy_registry:
        return {"status": "unconfigured"}, [], []
    registry_path = Path(args.policy_registry)
    if not registry_path.is_file():
        return {"status": "unreadable", "reason_code": "policy_registry_not_found"}, [], []
    try:
        with registry_path.open("rb") as handle:
            handle.read(1)
    except OSError:
        return {"status": "unreadable", "reason_code": "policy_registry_unreadable"}, [], []

    if args.policy_registry_src:
        source_root = Path(args.policy_registry_src)
        if not source_root.is_dir():
            return {"status": "unreadable", "reason_code": "policy_registry_package_unreadable"}, [], []
        sys.path.insert(0, str(source_root))
    try:
        module = importlib.import_module("policy_registry")
        registry_type = getattr(module, "PolicyRegistry")
    except (ImportError, AttributeError):
        return {"status": "unreadable", "reason_code": "policy_registry_package_unavailable"}, [], []

    try:
        data = registry_type(registry_path).load()
    except Exception:
        # The path was readable, so JSON/schema/entry failures are invalid data,
        # not an unavailable source. Never echo exception text or registry content.
        return {"status": "invalid", "reason_code": "policy_registry_validation_failed"}, [], []

    entries = data.get("entries", []) if isinstance(data, dict) else []
    if not isinstance(entries, list) or any(not isinstance(entry, dict) for entry in entries):
        return {"status": "invalid", "reason_code": "policy_registry_validation_failed"}, [], []

    norms: list[dict] = []
    candidates: list[dict] = []
    try:
        for entry in entries:
            source = entry.get("source") if isinstance(entry.get("source"), dict) else {}
            provenance = entry.get("provenance") if isinstance(entry.get("provenance"), dict) else {}
            intended_byum = (
                source.get("type") == "byum-projection"
                or provenance.get("protocol") == BYUM_PROTOCOL
            )
            if intended_byum:
                candidates.append(_project_byum_candidate(entry))
            elif entry.get("kind") in GOVERNANCE_NORM_KINDS:
                norms.append(_project_norm(entry))
    except BridgeError:
        return {"status": "invalid", "reason_code": "byum_candidate_contract_invalid"}, [], []

    norm_rows = norms[: args.registry_limit]
    candidate_rows = candidates[: args.registry_limit]
    return {
        "status": "available",
        "entry_count": len(entries),
        "governance_entry_count": len(norms),
        "governance_returned": len(norm_rows),
        "byum_candidate_count": len(candidates),
        "byum_candidates_returned": len(candidate_rows),
    }, norm_rows, candidate_rows


def _governance_plans(args) -> tuple[dict, list[dict]]:
    if not args.plans_register:
        return {"status": "unconfigured"}, []
    register_path = Path(args.plans_register)
    if not register_path.is_file():
        return {"status": "unreadable", "reason_code": "plans_register_not_found"}, []
    try:
        if register_path.stat().st_size > 1_048_576:
            return {"status": "invalid", "reason_code": "plans_register_too_large"}, []
        data = json.loads(register_path.read_text(encoding="utf-8"))
    except OSError:
        return {"status": "unreadable", "reason_code": "plans_register_unreadable"}, []
    except json.JSONDecodeError:
        return {"status": "invalid", "reason_code": "plans_register_validation_failed"}, []

    if not isinstance(data, dict) or data.get("schema") != PLANS_SCHEMA:
        return {"status": "invalid", "reason_code": "plans_register_validation_failed"}, []
    entries = data.get("plans")
    if not isinstance(entries, list) or any(not isinstance(entry, dict) for entry in entries):
        return {"status": "invalid", "reason_code": "plans_register_validation_failed"}, []

    projected: list[dict] = []
    try:
        for entry in entries:
            exists = entry.get("existiert")
            if not isinstance(exists, bool):
                raise BridgeError("plan existence metadata must be boolean")
            updated_at = entry.get("letzte_aktualisierung")
            if updated_at is not None:
                updated_at = _required_text(updated_at)
            projected.append({
                "id": _required_text(entry.get("id")),
                "name": _required_text(entry.get("name")),
                "status": _required_text(entry.get("status")),
                "owner": _required_text(entry.get("verantwortlich")),
                "exists": exists,
                "updated_at": updated_at,
            })
    except (BridgeError, AttributeError):
        return {"status": "invalid", "reason_code": "plans_projection_validation_failed"}, []

    rows = projected[: args.plan_limit]
    generated_at = data.get("generated_at")
    if generated_at is not None:
        try:
            generated_at = _required_text(generated_at)
        except BridgeError:
            return {"status": "invalid", "reason_code": "plans_register_validation_failed"}, []
    return {
        "status": "available",
        "plan_count": len(projected),
        "returned": len(rows),
        "generated_at": generated_at,
    }, rows


def cmd_list_governance(args) -> dict:
    decision_source, decisions = _governance_decisions(args)
    registry_source, registry_entries, byum_candidates = _governance_registry(args)
    plans_source, plans = _governance_plans(args)
    statuses = (decision_source["status"], registry_source["status"], plans_source["status"])
    complete = statuses == ("available", "available", "available")
    available_count = sum(status == "available" for status in statuses)
    verdict = "complete" if complete else "partial" if available_count else "unknown"
    return {
        "schema": "controlcenter.controlroom.governance/1",
        "command": "list-governance",
        "verdict": verdict,
        "complete": complete,
        "sources": {
            "decisions": decision_source,
            "policy_registry": registry_source,
            "plans_register": plans_source,
        },
        "counts": {
            "decisions": len(decisions),
            "registry_entries": len(registry_entries),
            "byum_candidates": len(byum_candidates),
            "plans": len(plans),
        },
        "decisions": decisions,
        "registry_entries": registry_entries,
        "byum_candidates": byum_candidates,
        "plans": plans,
    }


def _open_inventory_ro(db_path: Path) -> sqlite3.Connection:
    """Open the inventory DB read-only via a file: URI (mode=ro) -- never write here."""
    conn = sqlite3.connect(db_path.as_uri() + "?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def cmd_list_resources(args) -> dict:
    """Systems and/or software rows from the ControlRoom resource inventory
    (.SYNC/_inventory/inventory.db). Read-only mirror -- the canonical register is the
    database itself, reached natively via the source-resolver `resources.inventory`
    role; this command never writes and never becomes a second source of truth."""
    db_path = Path(args.inventory_db)
    if not db_path.is_file():
        return {
            "schema": SCHEMA,
            "command": "list-resources",
            "verdict": "unavailable",
            "reason": f"inventory database not found at {db_path}",
            "resources": [],
        }

    resource_type = (args.type or "all").lower()
    if resource_type not in ("all", "systems", "software"):
        raise BridgeError(f"unknown type: {resource_type} (expected systems, software, or all)")

    try:
        conn = _open_inventory_ro(db_path)
    except sqlite3.Error as exc:
        return {
            "schema": SCHEMA,
            "command": "list-resources",
            "verdict": "unavailable",
            "reason": f"inventory database unreadable: {exc}",
            "resources": [],
        }

    resources: list[dict] = []
    try:
        if resource_type in ("all", "systems"):
            query = "SELECT * FROM systems"
            params: list = []
            if args.host:
                query += " WHERE hostname = ? OR name = ?"
                params = [args.host, args.host]
            for row in conn.execute(query, params).fetchall():
                entry = dict(row)
                entry["resource_type"] = "systems"
                resources.append(entry)
        if resource_type in ("all", "software"):
            query = (
                "SELECT software.*, systems.hostname AS system_hostname, "
                "systems.name AS system_name FROM software "
                "JOIN systems ON software.system_id = systems.id"
            )
            params = []
            if args.host:
                query += " WHERE systems.hostname = ? OR systems.name = ?"
                params = [args.host, args.host]
            for row in conn.execute(query, params).fetchall():
                entry = dict(row)
                entry["resource_type"] = "software"
                resources.append(entry)
    except sqlite3.Error as exc:
        return {
            "schema": SCHEMA,
            "command": "list-resources",
            "verdict": "unavailable",
            "reason": f"inventory query failed: {exc}",
            "resources": [],
        }
    finally:
        conn.close()

    limited = resources[: args.limit]
    return {
        "schema": SCHEMA,
        "command": "list-resources",
        "verdict": "ok",
        "type_filter": resource_type,
        "host_filter": args.host or None,
        "match_count": len(resources),
        "returned": len(limited),
        "resources": limited,
    }


def cmd_describe_resource(args) -> dict:
    """Full row for one resource, addressed by its numeric inventory id + type."""
    db_path = Path(args.inventory_db)
    if not db_path.is_file():
        return {
            "schema": SCHEMA,
            "command": "describe-resource",
            "verdict": "unavailable",
            "reason": f"inventory database not found at {db_path}",
            "resource": None,
        }

    resource_type = (args.type or "systems").lower()
    if resource_type not in ("systems", "software"):
        raise BridgeError(f"unknown type: {resource_type} (expected systems or software)")

    try:
        conn = _open_inventory_ro(db_path)
        row = conn.execute(
            f"SELECT * FROM {resource_type} WHERE id = ?", (args.id,)
        ).fetchone()
    except sqlite3.Error as exc:
        return {
            "schema": SCHEMA,
            "command": "describe-resource",
            "verdict": "unavailable",
            "reason": f"inventory query failed: {exc}",
            "resource": None,
        }
    finally:
        conn.close()

    if row is None:
        return {
            "schema": SCHEMA,
            "command": "describe-resource",
            "verdict": "not_found",
            "reason": f"no {resource_type} row with id={args.id}",
            "resource": None,
        }

    entry = dict(row)
    entry["resource_type"] = resource_type
    return {
        "schema": SCHEMA,
        "command": "describe-resource",
        "verdict": "ok",
        "resource": entry,
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--scripts-dir", default="", help="Directory holding lock_utils.py etc.")
    parser.add_argument("--decisions-root", default="", help="Directory holding the decision chain.")
    parser.add_argument("--inventory-db", default="", help="Path to the resource inventory SQLite file.")
    parser.add_argument("--policy-registry", default="", help="Path to ellmos.policy-registry.v1 registry.json.")
    parser.add_argument("--policy-registry-src", default="", help="Optional src root containing policy_registry.")
    parser.add_argument("--plans-register", default="", help="Path to ellmos.plans-register/1 plans-register.json.")
    sub = parser.add_subparsers(dest="command", required=True)

    p_check = sub.add_parser("check-lock")
    p_check.add_argument("path")
    p_check.set_defaults(func=cmd_check_lock)

    p_list = sub.add_parser("list-locks")
    p_list.add_argument("--roots-file", default="")
    p_list.add_argument("--budget-seconds", default="60")
    p_list.set_defaults(func=cmd_list_locks)

    p_perm = sub.add_parser("evaluate-permission")
    p_perm.add_argument("path")
    p_perm.add_argument("agent")
    p_perm.add_argument("action")
    p_perm.set_defaults(func=cmd_evaluate_permission)

    p_dec = sub.add_parser("list-decisions")
    p_dec.add_argument("--status", default="OFFEN")
    p_dec.add_argument("--limit", type=int, default=50)
    p_dec.set_defaults(func=cmd_list_decisions)

    p_gov = sub.add_parser("list-governance")
    p_gov.add_argument("--status", default="OFFEN")
    p_gov.add_argument("--decision-limit", type=int, default=50)
    p_gov.add_argument("--registry-limit", type=int, default=200)
    p_gov.add_argument("--plan-limit", type=int, default=100)
    p_gov.set_defaults(func=cmd_list_governance)

    p_res = sub.add_parser("list-resources")
    p_res.add_argument("--type", default="all")
    p_res.add_argument("--host", default="")
    p_res.add_argument("--limit", type=int, default=100)
    p_res.set_defaults(func=cmd_list_resources)

    p_desc = sub.add_parser("describe-resource")
    p_desc.add_argument("id", type=int)
    p_desc.add_argument("--type", default="systems")
    p_desc.set_defaults(func=cmd_describe_resource)

    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        result = args.func(args)
    except BridgeError as exc:
        print(json.dumps({
            "schema": SCHEMA,
            "command": args.command,
            "verdict": "unknown",
            "safe_to_proceed": False,
            "error": str(exc),
        }, ensure_ascii=False), flush=True)
        return 2
    except Exception as exc:  # pragma: no cover - last resort, still fail closed
        print(json.dumps({
            "schema": SCHEMA,
            "command": args.command,
            "verdict": "unknown",
            "safe_to_proceed": False,
            "error": f"unexpected failure: {exc.__class__.__name__}: {exc}",
        }, ensure_ascii=False), flush=True)
        return 3

    result.setdefault("checked_at", datetime.now().isoformat(timespec="seconds"))
    print(json.dumps(result, ensure_ascii=False), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
