# Changelog

## Unreleased

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
