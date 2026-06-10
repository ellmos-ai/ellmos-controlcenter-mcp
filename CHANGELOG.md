# Changelog

## Unreleased

### Documentation
- Translated ROADMAP.md and STATE.md from German to English for consistency with the English-first project.
- Added Audience, Search Phrases, and Last-checked sections to `llms.txt`.

## 0.1.0-alpha.6 - 2026-06-05

- Vollständige ControlCenter-Textsets für Spanisch, Chinesisch, Japanisch und Russisch ergänzt.
- Sprachhinweise von Fallback-Status auf gepflegte Textsets für alle unterstützten Sprachen umgestellt.
- i18n-Tests erweitert, sodass registrierte Nicht-DE/EN-Sprachen echte lokalisierte Ausgaben und Profilempfehlungen liefern müssen.
- README, README_de, State, Architektur, Roadmap, TODO und LLM-Crawler-Zusammenfassung an den neuen i18n-Stand angepasst.

## 0.1.0-alpha.5 - 2026-06-05

- i18n-Infrastruktur für ControlCenter ergänzt: Sprachcodes `de`, `en`, `es`, `zh`, `ja` und `ru`, vollständige deutsche und englische Textsets sowie explizite Fallback-Sprachen.
- `controlcenter_get_language` und `controlcenter_set_language` ergänzt, damit MCP-Ausgaben zur Laufzeit zwischen Sprachen wechseln können.
- MCP-Ausgaben für Status, Tabellen, Tool-Katalog, Tool-Bundle-Zuordnung, Profiltools und Profil-Audit an die zentrale i18n-Schicht angebunden.
- Dashboard um Sprachwähler, `/?lang=...`-Rendering und `/api/language` erweitert.
- Dashboard um Tool-Katalog-Scan und Tool-Bundle-Zuordnung für Profilserver oder lokale Repositories erweitert.

## 0.1.0-alpha.4 - 2026-06-05

- `controlcenter_list_tools` ergänzt: lokale Stdio-MCP-Server können jetzt gestartet und per echter MCP-`list_tools`-Abfrage katalogisiert werden.
- `controlcenter_list_tools` auf aufgelöste Claude-Profilserver erweitert, inklusive beliebiger Stdio-Kommandos, Streamable HTTP und Legacy-SSE.
- `controlcenter_assign_tool_bundles` ergänzt: ausgelesene Tool-Metadaten werden Capability-Bundles zugeordnet.
- `controlcenter_build_catalog` kann mit `includeTools: true` optional Tool-Probe-Ergebnisse in den JSON-Katalog aufnehmen.
- `controlcenter_build_catalog` kann mit Profil-Toolscans und optionalen Tool-Bundle-Zuordnungen erweitert werden.
- `server.json` und neues `llms.txt` ins npm-Paket aufgenommen, damit MCP-Registry- und LLM-Crawler die ControlCenter-Metadaten über GitHub oder npm lesen können.
- Operative `*-protocoll.txt`-Botprotokolle aus dem veröffentlichten Repo entfernt und künftig ignoriert.
- README und README_de um Discovery-/Registry-Metadaten ergänzt.
- Der Standard-MCP-Root wird jetzt aus OneDrive- oder Home-Umgebung abgeleitet, statt einen lokalen Nutzerpfad im Release-Code zu tragen.

## 0.1.0-alpha.3 - 2026-05-26

- Capability-Bundles aus `data/capability-bundles.json` ladbar gemacht, inklusive `ELLMOS_BUNDLE_CONFIG` und optionalem `bundleConfigPath` für Bundle-Tools.
- Bundle-Konfigurationen werden jetzt validiert; ungültiges JSON, Schemafehler und doppelte Bundle-IDs liefern explizite `BundleConfigError`-Fehler.
- Policy-Regeln aus `data/policy-rules.json` ladbar gemacht, inklusive `ELLMOS_POLICY_CONFIG`, optionalem `policyConfigPath`, Rule-Deaktivierung und Severity-Overrides.
- Policy-Konfigurationen validieren JSON, Pflichtfelder, doppelte IDs, unbekannte Regeln und Severity-Werte mit expliziten `PolicyConfigError`-Fehlern.
- Profilauflösung robuster gemacht: einfache und mehrfache `extends`-Vererbung, `remove`/`disabled`/`disabledServers` für geerbte Server und deduplizierte Profilquellen.
- Nutzerfreundlichere Profilfehler für fehlende Profile, ungültige Profilnamen, ungültiges JSON, falsche JSON-Top-Level-Typen und Vererbungszyklen ergänzt.
- Tests für Profilvererbung, geerbte Serverentfernung und Profilfehler ausgebaut.

## 0.1.0-alpha.2 - 2026-05-23

- CI-Lockfile-Reproduzierbarkeit auf Linux verbessert
- `@emnapi/*` Dev-Dependencies für GitHub Actions stabilisiert

## 0.1.0-alpha.1 - 2026-05-23

- Alpha-Release für GitHub und npm vorbereitet
- Dashboard-Schreibaktionen mit Bestätigung und Backups abgesichert
- Security-Dokumentation ergänzt
- README mit Alpha-Hinweis, npm-Installation und Grenzen aktualisiert

## 0.1.0 - 2026-05-23

- Neues MVP-Repo für `ellmos-controlcenter-mcp` angelegt
- Discovery- und Profil-Grundfunktionen vorbereitet
- Build-, Test- und Registry-Basisdateien ergänzt
- Profilauflösung und `controlcenter_switch_profile` ergänzt
- Capability-Bundles und Bundle-Empfehlungen ergänzt
- Erstes Profil-Audit mit Policy-Findings ergänzt
- `ROADMAP.md` und lokales Browser-Dashboard ergänzt
- GitHub-CI und Emblem-Asset ergänzt
- Logo auf bereitgestellte ControlCenter-JPG-Datei umgestellt
