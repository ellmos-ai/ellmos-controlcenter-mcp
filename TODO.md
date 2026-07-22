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
- [x] Dashboard-Ansicht der Tool-Zuordnung ergänzen
- [x] i18n-Grundlage für MCP-Ausgaben und Dashboard mit Deutsch/Englisch ergänzen
- [x] Stub-Sprachen `es`, `zh`, `ja` und `ru` mit echten Übersetzungen füllen
- Remote-Auth und Header-Handling für Legacy-SSE ergänzen
- Capability-Tags in `server.json` oder separatem Catalog persistieren
- [x] Automatischen Scan für Skills und Plugins (mit Subkomponenten-Erkennung) implementieren
- [x] **Skill-Finder / Skill-Erkennung — ERLEDIGT 2026-06-27 (lexikalischer Kern, build grün, 57 Tests):** Tool `controlcenter_find_skill`
  (bzw. `controlcenter_suggest_skill`) — Freitext-Aufgabe/Intent gegen den bereits gescannten
  Skill-Katalog matchen und gerankte Kandidaten mit Trigger-Begründung zurückgeben (welche
  Beschreibungs-Phrase/welcher Tag/Alias traf). Signalquelle: `description` (als Trigger-Phrasen
  „Aktiviert sich bei …" verfasst), `tags`, `aliases` aus den `SKILL.md`-Frontmattern. Muster
  analog zu `suggest_bundles` / `suggest_profile`. Baut auf dem erledigten Skill-Scan auf.
  **Entscheidung (2026-06-27): lexikalisch als Kern** (Keyword/Alias über description+tags+aliases,
  zero-dependency, deterministisch); **Embedding/semantisches Ranking optional hinter Konfiguration**
  (Stretch-Goal, braucht lokales Embedding-Modell) — konsistent zum credential-/dependency-freien Design.
- Skill-Finder: Verfügbarkeit pro Agent-App über die `agent-config-sync`-Registry/Cache einbeziehen
  (welcher Agent exponiert welchen Skill wo), nicht nur Platte. `agent-config-sync` nutzt
  ControlCenter bereits als Profil-Backend (`resolve_profile`/`switch_profile`).
- Skill-Finder: Taxonomie/Logik mit dem Skill `skill-explorer` (Audit/Cluster/Finder) abstimmen,
  damit MCP-seitige Erkennung und skill-seitige Verwaltung dieselbe Systematik nutzen (speist auch
  die thematischen Cluster in P2).
- [x] Skill-Finder: `controlcenter_find_skill` Tool-/Input-Beschreibungen für alle 6 Sprachen
  (de/en/es/zh/ja/ru) übersetzt (ERLEDIGT 2026-06-27). English-Fallback bleibt nur Sicherheitsnetz.
- Ressourceninventar für Systempfade, installierte Software, ausführbare Dateien, EXE-Dateien, CLI-Apps und Software mit CLI-Schnittstelle planen
- Stack-Erkennung planen und implementieren: `ellmos-stack`, zukünftige Stack-Kataloge, `controlcenter.stack.json`, `ellmos-module.json`, `llms.txt`, `WIRING.md`, `server.json` und registrierte lokale Stack-Roots auswerten
- MCP-Tools für Stack-Karten ergänzen: `controlcenter_list_stacks` und `controlcenter_describe_stack`
- Capability-Finder spezifizieren: `controlcenter_find_capability` als Verallgemeinerung von `controlcenter_find_skill` für Tools, Skills, Module, Software, APIs und Stacks
- [x] Kontext-Packs als read-only Manifestübergabe umgesetzt: `controlcenter_context_pack` liefert `short`, `execution` und `full` ohne Komponentenstart, Geheimnisse oder Live-Zustand. Für Skill-/Modul-Dateiinhalte bleibt eine spätere, explizit policy-gebundene Erweiterung nötig.
- Private Stack-Instanzen unterstützen, ohne sie in den Core einzubauen: lokale Roots wie `_control-center` nur über Manifest/Konfiguration registrieren, nicht hardcoden oder automatisch für alle Nutzer anlegen
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
- Adapter-gesteuerte Ausführung planen: `controlcenter_plan_capability` zuerst als Dry-Run, `controlcenter_execute_capability` erst nach Policy-Gates, Audit-Log und expliziten Adapterverträgen
- BACH-Partnerprogramm und BACH-interne Skill-/Tool-Strukturen als Inspirations- und Importquelle prüfen
- Private Registry Feed
- Observability und Tool-Trace-Ansicht
