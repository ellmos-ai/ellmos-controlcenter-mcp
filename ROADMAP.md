# Roadmap

## Zielbild

`ellmos-controlcenter-mcp` soll zur lokalen Steuerzentrale für MCP-Server werden. Langfristig verwaltet es Profile, Server, Tools, Rechte, Audits und einen virtuellen Gateway-MCP, über den ausgewählte Tools als ein kontrollierter Server bereitgestellt werden.

## Phase 1: ControlCenter Dashboard

Status: begonnen

- Lokale MCP-Server anzeigen
- Claude-Profile anzeigen
- Server pro Profil aktivieren und deaktivieren
- Audit-Hinweise sichtbar machen
- Generierte `--mcp-config`-Dateien schreiben

## Phase 2: Tool-Katalog

Status: geplant

- Backend-MCP-Server starten
- `list_tools` pro Server auslesen
- Toolnamen, Beschreibungen und Schemas speichern
- Tools Capability-Bundles zuordnen

## Phase 3: Rechte und Policies

Status: geplant

- `policy.json` für Profile, Server und Tools
- Rechte: `allow`, `deny`, `ask`, `readonly`
- Secret-Werte maskieren
- Audit-Log für Profil- und Rechteänderungen

## Phase 4: Virtueller MCP-Gateway

Status: geplant

- Claude lädt nur noch den virtuellen `ellmos-controlcenter-gateway`
- Gateway startet ausgewählte Backend-Server
- Gateway veröffentlicht nur erlaubte Tools
- Tool-Aufrufe werden geprüft, geloggt und weitergeleitet

## Phase 5: Veröffentlichung

Status: geplant

- i18n mit Deutsch und Englisch
- stabiler Katalogstandard
- Sicherheitsdokumentation
- Paketierung für npm und GitHub
