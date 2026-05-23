# State

## Aktueller Stand

- Repo angelegt
- TypeScript-MCP-Grundgerüst vorhanden
- Erste Discovery- und Profiltools implementiert
- Tests für Kernlogik vorhanden
- Version `0.1.0-alpha.2` für GitHub/npm-Release vorbereitet

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
- Lokales Browser-Dashboard starten
- Server pro Profil über das Dashboard aktivieren/deaktivieren
- Schreibaktionen mit Bestätigung und Backup absichern

## Was noch fehlt

- Tool-Level-Erkennung per echter MCP-`list_tools`-Abfrage
- Tool-Level-Aktivierung über Gateway
- Tool-Gruppen dauerhaft konfigurieren
- Durchsetzende Policy-/Gateway-Schicht
- Remote-Registry-Unterstützung
- Observability mit Traces und Replay
- Laufende Claude-Sessions automatisch neu starten
