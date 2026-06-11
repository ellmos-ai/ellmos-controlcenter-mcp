# ellmos ControlCenter MCP

<p align="center">
  <img src="assets/controlcenter-logo.jpg" alt="ellmos ControlCenter MCP Logo" width="420">
</p>

**EN [English Version](README.md)**

*Teil der [ellmos-ai](https://github.com/ellmos-ai)-Familie.*

[![npm version](https://img.shields.io/npm/v/ellmos-controlcenter-mcp.svg)](https://www.npmjs.com/package/ellmos-controlcenter-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org/)

Ein Alpha-**Model Context Protocol (MCP) Control-Plane-Server** für lokale MCP-Stacks. ControlCenter entdeckt lokale MCP-Server, liest Claude-Profile, gruppiert Server in Capability-Bundles, empfiehlt Profile für Aufgaben, erzeugt Kataloge, fragt echte MCP-Toollisten aus lokalen Repos oder Profilen ab, ordnet Tools Capability-Bundles zu und bietet optional ein lokales Dashboard.

Der erste Alpha-Release konzentriert sich auf **Discovery, Profilsicht, Dashboard-Workflows, Capability-Bundles, profilfähige Toollisten-Probes, Tool-Bundle-Zuordnung, Internationalisierung und erste Policy-Audits**. Gateway-Modus, technisch erzwungene Tool-Level-Rechte, Authentifizierung und harte Sicherheitsgrenzen sind geplant, aber noch nicht implementiert.

> **Alpha-Hinweis:** Diese Version ist nützlich für lokale Verwaltung und Preview-Tests. Sie ist kein abgesicherter MCP-Gateway und sollte nicht als Schutzschicht für nicht vertrauenswürdige Tools oder fremde Nutzer verwendet werden.

## Status

- **Phase:** Alpha
- **Version:** `0.1.0-alpha.6`
- **Repository:** [`ellmos-ai/ellmos-controlcenter-mcp`](https://github.com/ellmos-ai/ellmos-controlcenter-mcp)
- **npm:** [`ellmos-controlcenter-mcp`](https://www.npmjs.com/package/ellmos-controlcenter-mcp)
- **CI-Checks:** `npm run test` und `npm run build`
- **Ziel:** Lokale MCP-Stacks sichtbar, prüfbar und leichter steuerbar machen
- **Schwerpunkt:** Kataloge, Profilübersicht, Profilempfehlung, Bundle-Empfehlung, profilfähige Toollisten-Probes, Tool-Bundle-Zuordnung, i18n und erste Audits

## Tools

| Tool | Zweck |
|---|---|
| `controlcenter_status` | Stack-, Profil- und Serverstatus anzeigen |
| `controlcenter_get_language` | Aktuelle ControlCenter-Ausgabesprache anzeigen |
| `controlcenter_set_language` | ControlCenter-Ausgabesprache für diese laufende Serverinstanz setzen |
| `controlcenter_list_local_servers` | Lokale MCP-Repositories unterhalb des MCP-Roots scannen |
| `controlcenter_list_tools` | Lokale oder profildefinierte MCP-Server starten und deren echte `list_tools`-Ausgabe lesen |
| `controlcenter_assign_tool_bundles` | Ausgelesene MCP-Tools Capability-Bundles zuordnen |
| `controlcenter_list_bundles` | Lokale Server nach Capability-Bundles gruppieren |
| `controlcenter_suggest_bundles` | Passende Bundles für eine Aufgabe empfehlen |
| `controlcenter_list_profiles` | Claude-Profile aus dem Profilordner auflisten |
| `controlcenter_suggest_profile` | Passendes Profil für eine Aufgabe empfehlen |
| `controlcenter_resolve_profile` | Profil inklusive `extends`-Ketten auflösen |
| `controlcenter_switch_profile` | Generierte `--mcp-config`-Datei vorbereiten |
| `controlcenter_audit_profile` | Erste Policy-Prüfungen gegen ein Profil ausführen |
| `controlcenter_build_catalog` | JSON-Katalog der lokalen MCP-Server erzeugen, optional inklusive Tool-Probes |

## Dashboard

Nach dem Build startet das lokale Dashboard mit:

```bash
npm run dashboard
```

Standardadresse:

```text
http://127.0.0.1:3737
```

Das Dashboard kann aktuell lokale Server und Profile anzeigen, seine UI-Sprache wechseln, Server pro Profil aktivieren oder deaktivieren, Profil-Audits zusammenfassen, MCP-Tools für das gewählte Profil oder lokale Repositories scannen, Tool-Bundle-Zuordnungen anzeigen und eine generierte `--mcp-config` schreiben. Schreibaktionen verlangen eine Bestätigung und legen vor dem Überschreiben ein Backup an.

## Discovery- und Registry-Metadaten

ControlCenter liefert MCP-Registry-Metadaten für Crawler und Katalogwerkzeuge mit:

- `server.json` nutzt das offizielle MCP-Server-Metadatenformat mit Paketname, Repository und Stdio-Transport.
- `llms.txt` gibt LLM-Crawlern eine kompakte Projektzusammenfassung, kanonische Links und eine Tool-Übersicht.
- `package.json` nimmt beide Dateien ins npm-Paket auf, damit Registry-Indexer dieselben Metadaten über GitHub oder npm lesen können.

Das öffentliche npm-Paket ist das kanonische Installationsziel. Das GitHub-Repository bleibt die kanonische Quelle für Entwicklung, Issues und Release Notes.

## Installation

### Option 1: Installation über npm

```bash
npm install -g ellmos-controlcenter-mcp
```

MCP-Server starten:

```bash
ellmos-controlcenter
```

Dashboard starten:

```bash
ellmos-controlcenter-dashboard
```

### Option 2: Installation aus dem Quellcode

```bash
git clone https://github.com/ellmos-ai/ellmos-controlcenter-mcp.git
cd ellmos-controlcenter-mcp
npm install
npm run build
```

Server aus dem Quellcode starten:

```bash
node dist/index.js
```

Dashboard aus dem Quellcode starten:

```bash
node dist/dashboard.js
```

## Konfiguration

### Claude Desktop / Claude Code

Bei globaler Installation über npm:

```json
{
  "mcpServers": {
    "controlcenter": {
      "command": "ellmos-controlcenter"
    }
  }
}
```

Bei Installation aus dem Quellcode:

```json
{
  "mcpServers": {
    "controlcenter": {
      "command": "node",
      "args": [
        "/absoluter/pfad/zu/ellmos-controlcenter-mcp/dist/index.js"
      ]
    }
  }
}
```

Optionale Umgebungsvariablen:

- `ELLMOS_MCP_ROOT` überschreibt den Standard-MCP-Root
- `ELLMOS_PROFILE_ROOT` überschreibt den Claude-Profilordner
- `ELLMOS_BUNDLE_CONFIG` überschreibt die Datei mit Capability-Bundle-Definitionen
- `ELLMOS_POLICY_CONFIG` überschreibt die Datei mit Profil-Audit-Regeln
- `CONTROLCENTER_LANGUAGE` oder `ELLMOS_CONTROLCENTER_LANGUAGE` setzt die initiale Ausgabesprache

Standardmäßig wird der MCP-Root aus der Umgebungsvariable `OneDrive`/`ONEDRIVE` abgeleitet und fällt sonst auf `~/OneDrive/.TOPICS/.AI/.MCP` zurück.

## Internationalisierung

ControlCenter unterstützt die Sprachcodes `de`, `en`, `es`, `zh`, `ja` und `ru`. Alle sechs Sprachen haben jetzt gepflegte Textsets für MCP-Toolausgaben, Dashboard-Labels, Policy-Hinweise, Profilempfehlungen und Tool-Beschreibungen.

Mit `controlcenter_get_language` lässt sich die aktuelle Sprache prüfen; `controlcenter_set_language` schaltet MCP-Toolausgaben zur Laufzeit um. Das Dashboard enthält ebenfalls einen Sprachwähler und akzeptiert Links wie `/?lang=en`. Bundle-Titel und -Beschreibungen aus eigenen JSON-Konfigurationsdateien werden so angezeigt, wie sie dort gepflegt sind.

## Profilwechsel

`controlcenter_switch_profile` verändert keine laufende Claude-Session. Das Tool erzeugt eine aufgelöste MCP-Konfiguration und gibt den passenden Startbefehl zurück:

```bash
claude --mcp-config ~/.claude/profiles/_generated/software.mcp.json
```

Mit `write: false` läuft der Wechsel als Vorschau. Mit `write: true` schreibt ControlCenter die generierte Datei.

Die Profilauflösung unterstützt einfache Vererbung (`"extends": "base"`), Mehrfachvererbung (`"extends": ["base", "shared"]`) und das Entfernen geerbter Server über `"remove"`, `"disabled"` oder `"disabledServers"`. Fehlende Profile, ungültiges JSON, ungültige Profilnamen und Vererbungszyklen liefern jetzt explizite Profilfehler mit betroffenem Dateipfad oder betroffener Kette.

## Capability-Bundles

ControlCenter lädt Capability-Bundle-Definitionen aus `data/capability-bundles.json`. Die Standarddatei gruppiert lokale Server in diese Bundles:

- `core-local`
- `software`
- `filesystem`
- `automation`
- `control-plane`

Eigene Bundle-Dateien können über `ELLMOS_BUNDLE_CONFIG` oder über den optionalen `bundleConfigPath`-Input der Bundle-Tools geladen werden. Eine Bundle-Datei ist ein JSON-Objekt mit `schemaVersion` und einem `bundles`-Array. Jedes Bundle benötigt `id`, `title`, `description` und `keywords`.

Das ist die Grundlage für späteres Tool-Bloat-Management: statt viele Einzeltools sofort sichtbar zu machen, kann ein Agent zuerst das passende Aufgaben-Bundle wählen.

## Tool-Katalog

`controlcenter_list_tools` kann lokale Stdio-MCP-Server oder aufgelöste Claude-Profilserver starten und die standardisierte MCP-`list_tools`-Abfrage ausführen. Profilscans unterstützen beliebige Stdio-Kommandos inklusive Nicht-Node-Startern sowie URL-basierte Remote-Konfigurationen über Streamable HTTP oder Legacy-SSE. Der Scan ist explizit, nutzt ein Timeout pro Server, ruft keines der gemeldeten Tools auf und beendet jeden gestarteten lokalen Server nach dem Lesen der Toolliste.

`controlcenter_build_catalog` akzeptiert `includeTools: true`, um dieselben Probe-Ergebnisse zusammen mit dem lokalen Serverkatalog zu speichern.

`controlcenter_assign_tool_bundles` vergleicht ausgelesene Toolnamen, Titel, Beschreibungen, Servernamen, Quelle und Transport mit den Keywords der Capability-Bundles und meldet dann, welche Tools zu Bundles wie Filesystem, Software, Automation oder Control Plane gehören.

## Profil-Audit

`controlcenter_audit_profile` ist die erste kleine Policy-Schicht. Sie markiert aktuell:

- `npx`-Starts
- Umgebungsvariablen in Server-Konfigurationen
- fehlende oder ungültige Server-Kommandos
- sensitive Namensbestandteile in Argumenten

Environment-Werte werden dabei nie ausgegeben.

Policy-Regeln werden standardmäßig aus `data/policy-rules.json` geladen. Die Datei kann einzelne Regeln deaktivieren oder deren Severity überschreiben; `controlcenter_audit_profile` akzeptiert zusätzlich einen `policyConfigPath`-Input für einzelne Audits.

## Projektstruktur

```text
ellmos-controlcenter-mcp/
|-- src/
|-- test/
|-- data/
|-- README.md
|-- README_de.md
|-- START.md
|-- ARCHITECTURE.md
|-- STATE.md
|-- DECISIONS.md
`-- TODO.md
```

## Dokumentation

| Für... | Lies... |
|---|---|
| Schnellstart | [START.md](./START.md) |
| Aktuellen Stand | [STATE.md](./STATE.md) |
| Architektur | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| Roadmap | [ROADMAP.md](./ROADMAP.md) |
| Entscheidungen | [DECISIONS.md](./DECISIONS.md) |
| Offene Aufgaben | [TODO.md](./TODO.md) |
| Änderungen | [CHANGELOG.md](./CHANGELOG.md) |
| LLM-Crawler-Zusammenfassung | [llms.txt](./llms.txt) |

## ellmos-ai-Ökosystem

Dieser MCP-Server ist Teil des **[ellmos-ai](https://github.com/ellmos-ai)**-Ökosystems: KI-Infrastruktur, MCP-Server und intelligente Werkzeuge.

### MCP-Server-Familie

| Server | Tools | Fokus | npm |
|--------|-------|-------|-----|
| [FileCommander](https://github.com/ellmos-ai/ellmos-filecommander-mcp) | 44 | Dateisystem, Prozessverwaltung, interaktive Sitzungen | [`ellmos-filecommander-mcp`](https://www.npmjs.com/package/ellmos-filecommander-mcp) |
| [CodeCommander](https://github.com/ellmos-ai/ellmos-codecommander-mcp) | 17 | Code-Analyse, AST-Parsing, Import-Verwaltung | [`ellmos-codecommander-mcp`](https://www.npmjs.com/package/ellmos-codecommander-mcp) |
| [Clatcher](https://github.com/ellmos-ai/ellmos-clatcher-mcp) | 12 | Dateireparatur, Formatkonvertierung, Batch-Operationen | [`ellmos-clatcher-mcp`](https://www.npmjs.com/package/ellmos-clatcher-mcp) |
| [n8n Manager](https://github.com/ellmos-ai/n8n-manager-mcp) | 18 | n8n-Workflow-Verwaltung über KI-Assistenten | [`n8n-manager-mcp`](https://www.npmjs.com/package/n8n-manager-mcp) |
| [Homebase](https://github.com/ellmos-ai/ellmos-homebase-mcp) | 44 | LLM-Memory, Wissen, State, Routing und Orchestrierung | [`ellmos-homebase-mcp`](https://www.npmjs.com/package/ellmos-homebase-mcp) (alpha) |
| [ServerCommander](https://github.com/ellmos-ai/ellmos-servercommander-mcp) | 8 | Server-Operationen: Deploy-Dry-Runs, Mail, Log-Analyse, Health-Checks | [`ellmos-servercommander-mcp`](https://www.npmjs.com/package/ellmos-servercommander-mcp) (alpha) |
| **[ControlCenter](https://github.com/ellmos-ai/ellmos-controlcenter-mcp)** | **14** | **MCP-Stack-Discovery, Profilverwaltung, Control Plane** | **[`ellmos-controlcenter-mcp`](https://www.npmjs.com/package/ellmos-controlcenter-mcp)** |

### KI-Infrastruktur

| Projekt | Beschreibung |
|---------|--------------|
| [BACH](https://github.com/ellmos-ai/bach) | Textbasiertes Betriebssystem für LLMs: Handler, Tools und Skills |
| [clutch](https://github.com/ellmos-ai/clutch) | Provider-neutrale LLM-Orchestrierung mit Auto-Routing und Budget-Tracking |
| [rinnsal](https://github.com/ellmos-ai/rinnsal) | Leichte Agent-Memory-, Connector- und Automatisierungsinfrastruktur |
| [ellmos-stack](https://github.com/ellmos-ai/ellmos-stack) | Self-hosted AI Research Stack |

## Lizenz

[MIT](LICENSE) - Lukas Geiger ([ellmos-ai](https://github.com/ellmos-ai))
