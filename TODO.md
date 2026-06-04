# TODO

## P0

- [x] Profilschema robuster lesen
- Katalogformat stabilisieren
- [x] Fehlerausgaben für fehlende Profile nutzerfreundlicher machen
- Capability-Bundles konfigurierbar machen statt nur heuristisch
- [x] Policy-Regeln konfigurierbar machen

## P1

- [x] Tool-Katalog über echte MCP-`list_tools`-Abfrage für lokale Stdio-Server grundlegend implementieren
- [x] Tool-Katalog auf Profilserver, Remote-Server und nicht lokale Startformen erweitern
- [x] Tool-Capability-Zuordnung für Bundles bauen
- Remote-Auth, Header-Handling für Legacy-SSE und Dashboard-Ansicht der Tool-Zuordnung ergänzen
- Capability-Tags in `server.json` oder separatem Catalog persistieren
- Automatischen Scan für Skills, Module, MCP-Server, Tool-Definitionen und lokale Konfigurationsquellen entwerfen
- Ressourceninventar für Systempfade, installierte Software, ausführbare Dateien, EXE-Dateien, CLI-Apps und Software mit CLI-Schnittstelle planen
- API-Erkennung aus Code, Profilen, Konfigurationen und Tool-Schemas spezifizieren
- Dokumentationskontext für erkannte APIs vorhalten, bevorzugt über Context7
- Thematische Cluster für Tools, MCPs, Skills, Module, APIs, Programme, EXE-Dateien und CLIs als Datenmodell definieren
- Cluster-Verwaltung planen: automatisch erzeugte Cluster aktivieren/deaktivieren, manuelle Cluster anlegen, Cluster ändern, umbenennen, zusammenführen und aufteilen
- Policy-Enforcement mit Allow-/Deny-Regeln
- Schreibender Profilmanager
- Optionaler Restart-/Hinweis-Workflow für Claude Code

## P2

- Gateway-Modus
- Virtuelle MCP-Server aus Clustern erzeugen, sodass ausgewählte Fähigkeitsgruppen als kuratierte Server bereitgestellt werden können
- BACH-Partnerprogramm und BACH-interne Skill-/Tool-Strukturen als Inspirations- und Importquelle prüfen
- Private Registry Feed
- Observability und Tool-Trace-Ansicht
