# ellmos ControlCenter MCP

<p align="center">
  <img src="assets/controlcenter-logo.jpg" alt="ellmos ControlCenter MCP logo" width="420">
</p>

> Ein MCP-Server als Steuerzentrale für den lokalen MCP-Stack: Server entdecken, Profile lesen, passende Profile empfehlen und Kataloge erzeugen.

*Part of the [ellmos-ai](https://github.com/ellmos-ai) family.*

`ellmos-controlcenter-mcp` ist als Infrastruktur-Schicht über euren bestehenden MCP-Servern gedacht. Der erste Alpha-Release konzentriert sich bewusst auf **Discovery, Profilsicht, Dashboard, Capability-Bundles und erste Policy-Audits**. Gateway, echtes Policy-Enforcement, Auth und Tool-Level-Rechte sind geplant, aber noch nicht als Sicherheitsgrenze umgesetzt.

> **Alpha-Hinweis:** Diese Version ist nützlich für lokale Verwaltung und Preview-Tests. Sie ist noch kein abgesicherter MCP-Gateway und sollte nicht als Schutzschicht für untrusted Tools oder fremde Nutzer verwendet werden.

## Status

- **Phase:** Alpha
- **Version:** `0.1.0-alpha.2`
- **Repository:** `ellmos-ai/ellmos-controlcenter-mcp`
- **CI:** `npm run test` and `npm run build`
- **Ziel:** Lokalen MCP-Stack sichtbar und steuerbar machen
- **Schwerpunkt:** Katalogisierung, Profilübersicht, Profilempfehlung

## Erste Tools im MVP

| Tool | Zweck |
|---|---|
| `controlcenter_status` | Überblick über Stack, Profile und erkannte Server |
| `controlcenter_list_local_servers` | Lokale MCP-Repos im MCP-Root scannen |
| `controlcenter_list_bundles` | Lokale Server nach Capability-Bundles gruppieren |
| `controlcenter_suggest_bundles` | Passende Bundles für eine Aufgabe empfehlen |
| `controlcenter_list_profiles` | Claude-Profile aus `~/.claude/profiles` auflisten |
| `controlcenter_suggest_profile` | Zu einer Aufgabe ein passendes Profil empfehlen |
| `controlcenter_resolve_profile` | Ein Profil inklusive `extends` auflösen |
| `controlcenter_switch_profile` | Eine startbare `--mcp-config`-Datei vorbereiten |
| `controlcenter_audit_profile` | Ein Profil auf erste Policy-Hinweise prüfen |
| `controlcenter_build_catalog` | Einen JSON-Katalog der lokalen Server erzeugen |

## Browser-GUI

Das lokale Dashboard startet nach dem Build mit:

```bash
npm run dashboard
```

Standardadresse:

```text
http://127.0.0.1:3737
```

Die GUI kann aktuell lokale Server anzeigen, Profile anzeigen, Server pro Profil aktivieren/deaktivieren, Profil-Audits zusammenfassen und eine generierte `--mcp-config` schreiben. Schreibaktionen verlangen eine Bestätigung und legen vor dem Überschreiben ein Backup an.

## ellmos Ecosystem Entry

**ellmos ControlCenter MCP** verwaltet lokale MCP-Server, Claude-Profile, Capability-Bundles und erste Policy-Audits. Es ist der geplante Control-Plane- und Gateway-Baustein für Tool-Bloat-Management, Profilwechsel und spätere Tool-Level-Rechte im ellmos-Ökosystem.

## Aktuelle Grenzen

- Tool-Level-Rechte sind sichtbar geplant, aber noch nicht technisch durchgesetzt.
- Ein aktivierter Backend-MCP-Server stellt weiterhin alle eigenen Tools bereit, solange kein Gateway davor geschaltet ist.
- Das Dashboard ist ein lokales Admin-Werkzeug ohne Benutzerlogin.
- Die i18n-Schicht ist noch nicht implementiert; die Alpha-Oberfläche ist deutschsprachig.

## Installation via npm

```bash
npm install -g ellmos-controlcenter-mcp@alpha
```

MCP-Server starten:

```bash
ellmos-controlcenter
```

Dashboard starten:

```bash
ellmos-controlcenter-dashboard
```

## Installation

```bash
cd C:\Users\User\OneDrive\.TOPICS\.AI\.MCP\ellmos-controlcenter-mcp
npm install
npm run build
```

## Quick Start

```bash
cd C:\Users\User\OneDrive\.TOPICS\.AI\.MCP\ellmos-controlcenter-mcp
npm run build
node dist/index.js
```

## Konfiguration

### Claude Desktop / Claude Code

```json
{
  "mcpServers": {
    "controlcenter": {
      "command": "node",
      "args": [
        "C:/Users/User/OneDrive/.TOPICS/.AI/.MCP/ellmos-controlcenter-mcp/dist/index.js"
      ]
    }
  }
}
```

Optional:

- `ELLMOS_MCP_ROOT` überschreibt den Standard-MCP-Root
- `ELLMOS_PROFILE_ROOT` überschreibt den Claude-Profilordner

## Profilwechsel

`controlcenter_switch_profile` verändert keine laufende Claude-Session. Das Tool erzeugt eine aufgelöste MCP-Konfiguration und gibt den passenden Startbefehl zurück:

```bash
claude --mcp-config C:\Users\User\.claude\profiles\_generated\software.mcp.json
```

Mit `write: false` läuft der Wechsel als Vorschau. Mit `write: true` wird die generierte Datei geschrieben.

## Capability-Bundles

ControlCenter gruppiert lokale Server aktuell in diese Bundles:

- `core-local`
- `software`
- `filesystem`
- `automation`
- `control-plane`

Das ist die Grundlage für späteres Tool-Bloat-Management: statt viele Einzeltools direkt sichtbar zu machen, kann ein Agent zuerst ein passendes Aufgaben-Bundle wählen.

## Profil-Audit

`controlcenter_audit_profile` ist die erste kleine Policy-Schicht. Sie markiert aktuell:

- `npx`-Starts
- Environment-Variablen in Server-Konfigurationen
- fehlende oder ungültige Server-Kommandos
- sensitive Namensbestandteile in Args

Environment-Werte werden dabei nicht ausgegeben.

## Projekt-Struktur

```text
ellmos-controlcenter-mcp/
├── src/
├── test/
├── data/
├── README.md
├── START.md
├── ARCHITECTURE.md
├── STATE.md
├── DECISIONS.md
└── TODO.md
```

## Dokumentation

| Für... | lies... |
|---|---|
| Schnellstart | [START.md](./START.md) |
| Aktuellen Stand | [STATE.md](./STATE.md) |
| Architektur | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| Roadmap | [ROADMAP.md](./ROADMAP.md) |
| Entscheidungen | [DECISIONS.md](./DECISIONS.md) |
| Offene Aufgaben | [TODO.md](./TODO.md) |
| Änderungen | [CHANGELOG.md](./CHANGELOG.md) |
