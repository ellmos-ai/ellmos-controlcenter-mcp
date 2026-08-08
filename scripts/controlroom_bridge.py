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

Fail-closed contract: every command that cannot determine an answer emits
`"verdict": "unknown"` (or the command's equivalent) and never a reassuring default.

Output: a single JSON object on stdout. Diagnostics go to stderr.

Usage:
    python controlroom_bridge.py --scripts-dir DIR check-lock PATH
    python controlroom_bridge.py --scripts-dir DIR list-locks [--roots-file F] [--budget-seconds N]
    python controlroom_bridge.py --scripts-dir DIR evaluate-permission PATH AGENT ACTION
    python controlroom_bridge.py --decisions-root DIR list-decisions [--status S] [--limit N]
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime
from pathlib import Path

SCHEMA = "controlcenter.controlroom/1"

# Decision index fields that are safe to surface. The index also carries the question
# text, option and recommendation excerpts, the raw decision field and absolute source
# paths. Those can describe personal circumstances, so they are deliberately dropped
# here rather than filtered later — the bridge never emits what it never reads out.
DECISION_PUBLIC_FIELDS = ("key", "id", "date", "title", "status", "scope", "source_file")


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


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--scripts-dir", default="", help="Directory holding lock_utils.py etc.")
    parser.add_argument("--decisions-root", default="", help="Directory holding the decision chain.")
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
