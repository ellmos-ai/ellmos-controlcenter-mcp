"""Narrow test fixture for the canonical PolicyRegistry.load() boundary.

The production bridge imports this package only when the test passes its explicit
``--policy-registry-src`` directory.  It mirrors the public load contract needed by
the bridge tests: schema and entry validation happen inside PolicyRegistry, never in
the TypeScript caller.
"""

from __future__ import annotations

import json
from pathlib import Path

SCHEMA = "ellmos.policy-registry.v1"
ENTRY_KINDS = {"policy", "rule", "decision", "evidence", "decision-candidate"}
STATUSES = {"active", "draft", "superseded", "revoked", "expired"}
ADOPTIONS = {"adopted", "partial", "pending", "exempt"}
PRIVACY = {"public", "internal", "private", "restricted"}
FORBIDDEN_CONTENT_KEYS = {"content", "body", "full_text", "fulltext", "payload"}


class RegistryError(RuntimeError):
    pass


class ValidationError(ValueError):
    pass


def _validate_entry(entry: dict) -> None:
    required = {
        "id", "kind", "title", "scope", "owner", "priority", "precedence",
        "version", "privacy", "source", "consumers", "status", "adoption",
    }
    missing = sorted(required - set(entry))
    if missing:
        raise ValidationError(f"Fehlende Felder: {', '.join(missing)}")
    if FORBIDDEN_CONTENT_KEYS & set(entry):
        raise ValidationError("Registry speichert keinen Volltext")
    if entry["kind"] not in ENTRY_KINDS:
        raise ValidationError("Unbekannter kind-Wert")
    if entry["status"] not in STATUSES:
        raise ValidationError("Unbekannter status-Wert")
    if entry["adoption"] not in ADOPTIONS:
        raise ValidationError("Unbekannter adoption-Wert")
    if entry["privacy"] not in PRIVACY:
        raise ValidationError("Unbekannter privacy-Wert")
    if not isinstance(entry["priority"], int) or not isinstance(entry["precedence"], int):
        raise ValidationError("priority und precedence müssen Ganzzahlen sein")
    if not isinstance(entry["consumers"], list):
        raise ValidationError("consumers muss eine Liste sein")
    source = entry["source"]
    if not isinstance(source, dict) or not source.get("uri"):
        raise ValidationError("source.uri ist erforderlich")
    hash_value = entry.get("hash")
    if hash_value is not None:
        value = hash_value.get("value", "") if isinstance(hash_value, dict) else ""
        if hash_value.get("algorithm") != "sha256" or (
            value and (len(value) != 64 or any(c not in "0123456789abcdef" for c in value.lower()))
        ):
            raise ValidationError("Ungültiger SHA-256-Wert")


class PolicyRegistry:
    def __init__(self, path: str | Path):
        self.path = Path(path)

    def load(self) -> dict:
        if not self.path.exists():
            return {"schema": SCHEMA, "updated_at": None, "entries": []}
        try:
            data = json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise RegistryError(f"Registry nicht lesbar: {exc}") from exc
        if data.get("schema") != SCHEMA or not isinstance(data.get("entries"), list):
            raise RegistryError("Ungültiges Registry-Format")
        for entry in data["entries"]:
            if not isinstance(entry, dict):
                raise ValidationError("Registry-Eintrag muss ein Objekt sein")
            _validate_entry(entry)
        return data


__all__ = ["PolicyRegistry", "RegistryError", "ValidationError"]
