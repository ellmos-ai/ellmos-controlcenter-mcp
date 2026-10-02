# Contributing to ellmos-controlcenter-mcp / Mitwirken an ellmos-controlcenter-mcp

[English](#english) | [Deutsch](#deutsch)

---

<a id="english"></a>
## English

Thank you for your interest in contributing to **ellmos-controlcenter-mcp** (`ellmos-ai/ellmos-controlcenter-mcp`), the authoritative Model Context Protocol (MCP) control plane and policy-gated gateway server for local-first MCP stack discovery, profile management, capability bundle composition, and on-demand tool routing.

### 1. Architectural Principles & 10 Governance Invariants

All contributions must strictly uphold our core architectural invariants:

1. **Local-First Administration & Explicit Egress (`INV-LOCAL-01`)**: Discovery, profile resolution, and local dashboard interfaces operate strictly on local loopback (`127.0.0.1`) with zero telemetry or background egress. Explicit gateway calls may target remote HTTPS backends; redirects are refused and an optional host allowlist narrows destinations.
2. **Fail-Closed Gateway Policy Guard (`INV-GATE-02`)**: Gateway tool invocation (`controlcenter_invoke`) is strictly bounded by pattern-based policy rules (`data/gateway-policy.json`). Missing, inaccessible, or unparseable policy manifests unconditionally deny every call.
3. **Ephemeral Stdio Child Process Boundaries (`INV-SUB-03`)**: Connect-per-call stdio lifecycle. Subprocesses for tool inspection and tool execution terminate immediately upon delivery of results, leaving zero lingering background daemons or zombie processes.
4. **Recursive Secret Redaction & Finite Budgets (`INV-SCRUB-04`)**: Automated secret scrubbing across input arguments and response payloads. Pattern scrubbing applies everywhere; key-based wiping is confined to structured metadata so requested file contents are never silently modified. Bounded by 256 KiB request, 1 MiB response, and recursion depth limits.
5. **Non-Elevation User Mode (`INV-PRIV-05`)**: Pure `RunAsInvoker` standard user mode execution. The server and its scripts require zero administrative elevation, zero root/sudo privileges, and zero background system services.
6. **Canonical Multi-Agent Lock Awareness (`INV-LOCK-06`)**: Full introspection of canonical multi-agent project locks (`LOCK*.txt`, `LOCK.user.*`, `LOCK.until.*`, `LOCK.condition.*`). Active lock areas fail closed (read-only enforcement).
7. **Nearest Permission Register Introspection (`INV-PERM-07`)**: Hierarchical, recursive discovery and evaluation of `LOCK.permissions.json` up directory trees to enforce granular role-based tool and file permissions.
8. **Read-Only Host Governance Federation (`INV-GOV-08`)**: Transparent read-only mirroring of host-level decisions, policy registries, and system/software inventories (`.SYNC/_inventory/inventory.db`) without mutating authority.
9. **Cloud-Sync Conflict Hardening (`INV-SYNC-09`)**: Hardened `.gitignore` defense preventing cloud-sync collisions (`*-WORKSTATION*`, `*-IDEAPAD*`, `*conflicted copy*`) and multi-agent coordination locks (`LOCK*`, `LOCK.user.*`, `LOCK.until.*`, `LOCK.condition.*`).
10. **Bilingual Security SLA (`INV-SLA-10`)**: Binding 48-hour response confirmation, 5-business-day triage assessment, and coordinated vulnerability remediation via `security@open-bricks.org` and `security@ellmos.ai`.

### 2. Plan D Local Development Workflow

In accordance with our repository architecture (Plan D), the canonical local git repository serves as the authoritative **Source of Truth** (`C:\_Local_DEV\repos\ellmos-controlcenter-mcp`). Development, testing, and commits must take place exclusively in the local clone.

```bash
# Clone the canonical repository
git clone https://github.com/ellmos-ai/ellmos-controlcenter-mcp.git
cd ellmos-controlcenter-mcp

# Install dependencies
npm install

# Build TypeScript sources
npm run build

# Run automated vitest test suite
npm test
```

### 3. Version Freeze Discipline (`T-20260920-167562623`)

`ellmos-controlcenter-mcp` operates under strict version-freeze discipline. Version `0.7.4` in `package.json`, `package-lock.json`, `server.json`, `glama.json`, and documentation badges must not be incremented without explicit release authorization. All technical hygiene, documentation updates, and workflow additions are documented under `## [Unreleased]` in `CHANGELOG.md`.

### 4. Quality Gates

Before submitting a pull request, verify that all quality gates pass:
1. `npm run build`: Zero TypeScript compilation errors.
2. `npm test`: 100% green test execution across all unit, integration, and metadata contract suites.
3. `git diff --check`: Zero whitespace anomalies.
4. `git diff -G"version"`: Zero unauthorized version modifications.

### 5. Statutory Notice (§ 521 BGB) & Liability Disclaimer

This software is provided free of charge as open-source software under the MIT License. In accordance with statutory German law (§ 521 BGB - Gefälligkeitsrecht), liability for defects in quality and title is strictly limited to intentional misconduct (*Vorsatz*) and gross negligence (*grobe Fahrlässigkeit*).

### 6. Security Contact & Vulnerability Reporting

Please report security issues privately:
- Maintainer & Security Team: [security@open-bricks.org](mailto:security@open-bricks.org), [security@ellmos.ai](mailto:security@ellmos.ai), [lukas@open-bricks.org](mailto:lukas@open-bricks.org), [support@lukasgeiger.com](mailto:support@lukasgeiger.com)
- Adhere to the 48h Security Response SLA (`INV-SLA-10`) as detailed in [SECURITY.md](SECURITY.md).

---

<a id="deutsch"></a>
## Deutsch

Vielen Dank für dein Interesse an einer Mitwirkung bei **ellmos-controlcenter-mcp** (`ellmos-ai/ellmos-controlcenter-mcp`), dem maßgeblichen Model Context Protocol (MCP) Control-Plane- und Policy-Gated Gateway-Server für lokale MCP-Stack-Erkennung, Profilverwaltung, Capability-Bundle-Komposition und dynamisches Tool-Routing.

### 1. Architektur-Prinzipien & 10 Governance-Invarianten

Alle Beiträge müssen unsere verbindlichen Kern-Invarianten strikt einhalten:

1. **Lokale Administration & Expliziter Egress (`INV-LOCAL-01`)**: Entdeckung, Profilauflösung und lokales Dashboard laufen ausschließlich über Loopback (`127.0.0.1`) ohne Telemetrie oder Hintergrundübertragungen. Explizite Gateway-Aufrufe können konfigurierte HTTPS-Endpunkte ansprechen; Weiterleitungen werden abgewiesen und eine optionale Allowlist grenzt Ziele ein.
2. **Fail-Closed Gateway Policy Guard (`INV-GATE-02`)**: Gateway-Werkzeugaufrufe (`controlcenter_invoke`) werden strikt durch deklarative Regeln (`data/gateway-policy.json`) beschränkt. Fehlende oder fehlerhafte Policy-Dateien verweigern jeden Aufruf ausnahmslos.
3. **Ephemere Stdio Kindprozess-Grenzen (`INV-SUB-03`)**: Connect-per-Call Stdio-Lebenszyklus. Kindprozesse zur Tool-Erkundung und Tool-Ausführung werden unmittelbar nach der Ergebnisrückgabe beendet; keine verbleibenden Zombie-Prozesse oder Hintergrund-Daemons.
4. **Rekursive Secret-Bereinigung & Endliche Budgets (`INV-SCRUB-04`)**: Automatische Bereinigung sensibler Secrets in Argumenten und Antworten. Musterbasierte Erkennung gilt global; schlüsselbasierte Maskierung ist auf strukturierte Metadaten beschränkt. Harte Obergrenzen von 256 KiB Anfrage, 1 MiB Antwort und begrenzter Rekursionstiefe.
5. **Rechtefreier Benutzermodus (`INV-PRIV-05`)**: Reiner `RunAsInvoker`-Standardbenutzermodus. Der Server und seine Skripte erfordern keinerlei administrative Rechte, kein root/sudo und keine System-Daemon-Registrierungen.
6. **Kanonische Multi-Agenten Lock-Beachtung (`INV-LOCK-06`)**: Vollständige Introspektion kanonischer Multi-Agenten-Sperren (`LOCK*.txt`, `LOCK.user.*`, `LOCK.until.*`, `LOCK.condition.*`). Gesperrte Bereiche werden strikt read-only geschützt.
7. **Hierarchische Rechteprüfung (`INV-PERM-07`)**: Rekursive Erkennung und Auswertung von `LOCK.permissions.json` entlang des Verzeichnisbaums zur Durchsetzung rollenbasierter Werkzeug- und Dateiberechtigungen.
8. **Schreibgeschützte Host-Governance-Spiegelung (`INV-GOV-08`)**: Transparente Read-Only-Spiegelung von Host-Entscheidungen, Richtlinien und System-/Software-Inventaren (`.SYNC/_inventory/inventory.db`) ohne schreibende Hoheit.
9. **Cloud-Sync Konflikt- & Lock-Schutz (`INV-SYNC-09`)**: Gehärtete `.gitignore` gegen Cloud-Sync-Konfliktdateien (`*-WORKSTATION*`, `*-IDEAPAD*`, `*conflicted copy*`) und Multi-Agenten-Locks (`LOCK*`, `LOCK.user.*`, `LOCK.until.*`, `LOCK.condition.*`).
10. **Zweisprachige Sicherheits-SLA (`INV-SLA-10`)**: Verbindliche 48-Stunden-Erstantwortgarantie, 5-Werktage-Triage-Zusage und koordinierte Behebung von Sicherheitsmeldungen über `security@open-bricks.org` und `security@ellmos.ai`.

### 2. Plan D Lokaler Entwicklungsworkflow

Gemäß unserer Architektur (Plan D) bildet das lokale Git-Repository die alleinige maßgebliche **Source of Truth** (`C:\_Local_DEV\repos\ellmos-controlcenter-mcp`). Entwicklung, Tests und Commits finden ausschließlich im kanonischen lokalen Klon statt.

```bash
# Kanonischen Klon verwenden
git clone https://github.com/ellmos-ai/ellmos-controlcenter-mcp.git
cd ellmos-controlcenter-mcp

# Abhängigkeiten installieren
npm install

# TypeScript-Quellcode kompilieren
npm run build

# Vitest-Testsuite ausführen
npm test
```

### 3. Version Freeze Discipline (`T-20260920-167562623`)

`ellmos-controlcenter-mcp` unterliegt einer strikten Versions-Freeze-Disziplin. Die Version `0.7.4` in `package.json`, `package-lock.json`, `server.json`, `glama.json` und Dokumentations-Badges darf ohne ausdrückliche Freigabe nicht erhöht werden. Alle technischen Hygiene-Änderungen und Dokumentationserweiterungen werden unter `## [Unreleased]` in `CHANGELOG.md` erfasst.

### 4. Qualitäts-Tore (Quality Gates)

Vor jedem Pull Request müssen alle lokalen Prüfschritte erfolgreich sein:
1. `npm run build`: Null TypeScript-Kompilierungsfehler.
2. `npm test`: 100% grüne Tests über alle Testsuiten hinweg.
3. `git diff --check`: Keine Whitespace- oder Zeilenumbruchfehler.
4. `git diff -G"version"`: Keine unautorisierten Versionsänderungen.

### 5. Gesetzlicher Hinweis (§ 521 BGB) & Haftungsausschluss

Diese Software wird unentgeltlich als Open-Source-Software unter den Bedingungen der MIT-Lizenz bereitgestellt. Gemäß § 521 BGB (Gefälligkeitsrecht) ist die Haftung für Sach- und Rechtsmängel auf Vorsatz und grobe Fahrlässigkeit beschränkt.

### 6. Sicherheitskontakt & Meldung von Schwachstellen

Sicherheitsrelevante Befunde bitte vertraulich melden an:
- Betreuer & Sicherheitsteam: [security@open-bricks.org](mailto:security@open-bricks.org), [security@ellmos.ai](mailto:security@ellmos.ai), [lukas@open-bricks.org](mailto:lukas@open-bricks.org), [support@lukasgeiger.com](mailto:support@lukasgeiger.com)
- Verbindliche Einhaltung der 48-Stunden-Sicherheits-SLA (`INV-SLA-10`) gemäß [SECURITY.md](SECURITY.md).
