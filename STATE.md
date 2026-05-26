# State

## Aktueller Stand

- Repo angelegt
- TypeScript-MCP-Grundgerüst vorhanden
- Erste Discovery- und Profiltools implementiert
- Tests für Kernlogik vorhanden
- Version `0.1.0-alpha.3` für GitHub/npm-Release vorbereitet

## Was der MVP schon kann

- Lokale MCP-Repos erkennen
- Metadaten aus `package.json` lesen
- Tool-Anzahlen grob aus Beschreibungen ableiten
- Claude-Profile lesen und zusammenfassen
- Ein Profil anhand von Aufgaben-Keywords empfehlen
- Einen JSON-Katalog schreiben
- Profile inklusive `extends` auflösen
- Generierte `--mcp-config`-Dateien für Profilwechsel vorbereiten
- Lokale Server in Capability-Bundles gruppieren
- Capability-Bundles anhand einer Aufgabe empfehlen
- Profile auf erste Policy-Hinweise auditieren
- Policy-Regeln aus `data/policy-rules.json` laden, deaktivieren und in ihrer Severity überschreiben
- Lokales Browser-Dashboard starten
- Server pro Profil über das Dashboard aktivieren/deaktivieren
- Schreibaktionen mit Bestätigung und Backup absichern

## Was noch fehlt

- Tool-Level-Erkennung per echter MCP-`list_tools`-Abfrage
- Automatische Erkennung von Skills, Modulen, APIs, lokalen Programmen, EXE-Dateien, CLI-Apps und Systemressourcen
- Thematische Cluster, die automatisch vorgeschlagen und manuell gepflegt werden können
- Virtuelle MCP-Server, die aus kuratierten Clustern entstehen
- Tool-Level-Aktivierung über Gateway
- Tool-Gruppen dauerhaft konfigurieren
- Durchsetzende Policy-/Gateway-Schicht
- Remote-Registry-Unterstützung
- Observability mit Traces und Replay
- Laufende Claude-Sessions automatisch neu starten
