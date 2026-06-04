# Roadmap

## Zielbild

`ellmos-controlcenter-mcp` soll zur lokalen Steuerzentrale für MCP-Server und das gesamte lokale Agenten-Werkzeugökosystem werden. Langfristig verwaltet es Profile, Server, Tools, Skills, Module, APIs, lokale Programme, EXE-Dateien, CLI-Apps, Rechte, Audits und virtuelle Gateway-MCPs, über die ausgewählte Fähigkeiten als kontrollierte Server bereitgestellt werden.

## Phase 1: ControlCenter Dashboard

Status: begonnen

- Lokale MCP-Server anzeigen
- Claude-Profile anzeigen
- Server pro Profil aktivieren und deaktivieren
- Audit-Hinweise sichtbar machen
- Generierte `--mcp-config`-Dateien schreiben

## Phase 2: Tool-Katalog

Status: begonnen

- [x] Lokale Backend-MCP-Server kontrolliert starten
- [x] `list_tools` pro lokalem Stdio-Server auslesen
- [x] Toolnamen, Beschreibungen und Schemas in Probe-Ergebnissen speichern
- [x] Profilserver, Remote-Server und alternative Startformen anbinden
- [x] Tools Capability-Bundles zuordnen
- Remote-Authentifizierung, Header-Sonderfälle und Dashboard-Visualisierung nachziehen

## Phase 2.5: Ressourcen-, Skill- und API-Inventar

Status: geplant

- Automatische Scans für Skills, Module, MCP-Server, Tool-Definitionen und lokale Konfigurationsquellen
- Systemressourcen erkennen: Pfade, installierte Software, ausführbare Dateien, EXE-Dateien, CLI-Apps und Software mit CLI-Schnittstelle
- Nutzungsmöglichkeiten erkannter Software erfassen, zum Beispiel unterstützte Dateitypen, typische Befehle, lokale APIs und Automatisierungswege
- Verwendete APIs aus Code, Konfigurationen, Profilen und Tool-Schemas erkennen
- Zu erkannten APIs aktuelle Dokumentation referenzieren oder vorhalten, bevorzugt über Context7 oder vergleichbare Dokumentationsquellen
- BACH-Partnerprogramm und BACH-interne Tool-/Skill-Strukturen als Impulsquelle auswerten

## Phase 3: Rechte und Policies

Status: geplant

- `policy.json` für Profile, Server und Tools
- Rechte: `allow`, `deny`, `ask`, `readonly`
- Secret-Werte maskieren
- Audit-Log für Profil- und Rechteänderungen

## Phase 3.5: Thematische Cluster und virtuelle Server

Status: geplant

- Erkannte Tools, MCPs, Skills, Module, APIs, Programme, EXE-Dateien und CLIs automatisch thematisch clustern
- Globale Cluster aktivieren und deaktivieren können
- Manuelle Cluster anlegen
- Automatisch angelegte Cluster manuell ändern, umbenennen, zusammenführen oder aufteilen
- Cluster stabil benennen und mit Beschreibungen, Tags und Einsatzbeispielen versehen
- Cluster zu virtuellen MCP-Servern verbinden, sodass Agenten statt vieler Einzelquellen kuratierte Fähigkeitsserver laden können
- Cluster als Grundlage für Profile, Gateway-Regeln, Dokumentationskontext und Dashboard-Ansichten nutzen

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
