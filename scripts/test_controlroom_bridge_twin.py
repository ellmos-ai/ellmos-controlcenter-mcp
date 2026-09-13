r"""check-lock muss den Zwilling im anderen Baum mitzählen (T-20260913-715231627).

Der Regressionsfall: `LOCK.user.*` ist absichtlich unversioniert, ein frisch
geklontes Repo kann ihn also gar nicht enthalten. Zählt `check-lock` nur die
Ahnenkette des übergebenen Pfades, meldet es dort `clear` / `safe_to_proceed:
true` — obwohl der OneDrive-Zwilling gesperrt ist. Am 2026-09-10 hat genau
diese Lücke einen Judging-Hold überschritten.

Der Test braucht die kanonischen Lock-Module des Hosts (lock_utils.py,
permissions.py). Fehlen sie oder ist ihre Fassung älter als die
Zwillingsauflösung, überspringt er sich selbst mit klarer Meldung statt grün zu
lügen.

Lauf:  PYTHONIOENCODING=utf-8 python scripts/test_controlroom_bridge_twin.py [scripts-dir]
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
BRIDGE = HERE / "controlroom_bridge.py"
B = chr(92)


def default_scripts_dir() -> Path:
    env = os.environ.get("CONTROLROOM_SCRIPTS")
    if env:
        return Path(env)
    home = Path(os.environ.get("USERPROFILE") or Path.home())
    return home / "OneDrive" / "_scripts"


def run_check(scripts_dir: Path, target: Path) -> dict:
    out = subprocess.run(
        [sys.executable, str(BRIDGE), "--scripts-dir", str(scripts_dir),
         "check-lock", str(target)],
        capture_output=True, text=True, encoding="utf-8",
    )
    if not out.stdout.strip():
        raise AssertionError(f"keine Ausgabe: {out.stderr[:400]}")
    return json.loads(out.stdout)


def build_pair(tmp: Path, scripts_dir: Path) -> tuple[Path, Path]:
    """Klon + OneDrive-Zwilling, Lock NUR am Zwilling -- wie im echten Fall."""
    clone, twin = tmp / "repos" / "demo", tmp / "onedrive" / "demo"
    clone.mkdir(parents=True)
    twin.mkdir(parents=True)
    (twin / "LOCK.user.txt").write_text("Testlock, nur am Zwilling.\n", encoding="utf-8")
    (twin / "REPO.pointer.json").write_text(json.dumps({
        "schema": "ellmos-repo-pointer-v1", "repo_id": "x/demo",
        "local_locator": {"repo_name": "demo", "windows_default": str(clone)},
    }), encoding="utf-8")

    # Eigener scripts-Ordner: die kanonischen Module des Hosts plus eine
    # lock_roots.json, die auf DIESE Wegwerf-Baeume zeigt -- der Test fasst die
    # echte Konfiguration des Hosts nicht an.
    sandbox = tmp / "scripts"
    sandbox.mkdir()
    for name in ("lock_utils.py", "permissions.py", "lock_scan.py"):
        src = scripts_dir / name
        if src.is_file():
            (sandbox / name).write_bytes(src.read_bytes())
    index = tmp / "TWIN-INDEX.json"
    (sandbox / "lock_roots.json").write_text(json.dumps({
        "default_max_depth": 4, "shallow_depth": 2, "skip_dirs": [],
        "roots": [{"path": str(tmp / "repos")}, {"path": str(tmp / "onedrive")}],
        "twin_resolution": {"clone_roots": [str(tmp / "repos")], "index_path": str(index)},
    }), encoding="utf-8")
    subprocess.run([sys.executable, str(sandbox / "lock_scan.py"), "--write-cache",
                    "--roots-file", str(sandbox / "lock_roots.json")],
                   capture_output=True, text=True)
    return clone, sandbox


def main() -> int:
    scripts_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else default_scripts_dir()
    if not (scripts_dir / "lock_utils.py").is_file():
        print(f"UEBERSPRUNGEN: keine kanonischen Lock-Module unter {scripts_dir}")
        return 0
    sys.path.insert(0, str(scripts_dir))
    import lock_utils  # noqa: PLC0415
    if not hasattr(lock_utils, "twin_dirs_for_path"):
        print("UEBERSPRUNGEN: die kanonische Fassung kennt die Zwillingsaufloesung "
              "noch nicht (lock-master T-20260913-785936980 nicht deployt).")
        return 0

    fails = []
    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td)
        clone, sandbox = build_pair(tmp, scripts_dir)

        # 1) Der Regressionsfall: Lock nur am Zwilling -> nicht "clear".
        res = run_check(sandbox, clone)
        if res["verdict"] != "locked" or res["safe_to_proceed"]:
            fails.append(f"Lock am Zwilling nicht gesehen: {res['verdict']} / "
                         f"safe_to_proceed={res['safe_to_proceed']}")
        elif not any(l.get("from_twin") for l in res["locks"]):
            fails.append("Lock gefunden, aber nicht als from_twin ausgewiesen")

        # 2) Fail-closed: Index weg -> kein "clear" auf gut Glueck.
        index = json.loads((sandbox / "lock_roots.json").read_text(encoding="utf-8"))
        Path(index["twin_resolution"]["index_path"]).unlink()
        res = run_check(sandbox, clone)
        if res["safe_to_proceed"]:
            fails.append("fehlender TWIN-INDEX wurde als 'safe to proceed' gemeldet")

        # 3) Ohne Konfiguration unveraendertes Verhalten (kein Fehler, kein Zwilling).
        cfg = json.loads((sandbox / "lock_roots.json").read_text(encoding="utf-8"))
        cfg.pop("twin_resolution")
        (sandbox / "lock_roots.json").write_text(json.dumps(cfg), encoding="utf-8")
        res = run_check(sandbox, clone)
        if res["verdict"] != "clear" or not res["safe_to_proceed"]:
            fails.append(f"ohne twin_resolution nicht mehr das alte Verhalten: {res['verdict']}")

    for f in fails:
        print(f"  FAIL {f}")
    print("ALLE GRUEN" if not fails else f"{len(fails)} FEHLGESCHLAGEN")
    return 1 if fails else 0


if __name__ == "__main__":
    raise SystemExit(main())
