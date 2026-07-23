# Changelog

## 0.2.1 - 2026-07-24

### Added
- Add `controlcenter_context_pack` for bounded `short`, `execution`, and `full` stack handoffs. It carries only registered manifest metadata, omits absolute local paths, and explicitly distinguishes declared policies from runtime enforcement.
- Add planned personal-domain capability bundles for ControlCenter dashboard and future MCP packlists: office, privacy, tax/finance, health, notes/knowledge, and local data readers.
- Document the stack/capability recognition plan, including neutral stack manifests, private stack instances, context packs, and adapter-gated execution.

### Changed
- Unified the ellmos-ai ecosystem section in README.md and README_de.md: full 9-server MCP family table with refreshed tool counts, AI infrastructure, and desktop software links.
- Added `glama.json` for the Glama MCP directory listing.
- Synced `server.json` version metadata.

## 0.2.0 - 2026-07-03

### Added
- **Skill recognition / skill-finder.** New tool `controlcenter_find_skill`: matches a free-text task/intent against the scanned skill catalogue and returns ranked candidates with the matched terms. Lexical matching at the core (keyword/alias overlap over name, aliases, tags, category, and description — zero-dependency, deterministic); embedding/semantic ranking remains a documented stretch goal behind explicit configuration.
- `SkillSummary` now carries `tags` and `aliases` (parsed from SKILL.md frontmatter via the new `parseInlineList` helper), so the finder can weight precise hooks above the broad description.
- Test coverage for the skill-finder (tokenisation, ranking, field weighting, limit, no-match).

### Changed
- Rename profile helpers to provider-neutral `McpProfile*` names while keeping deprecated `ClaudeProfile*` aliases for compatibility.
- Make the generated profile-switch launch command configurable via `launchTemplate` or `ELLMOS_LAUNCH_TEMPLATE`.
- Broadened npm keywords with provider-neutral MCP discovery terms such as `mcp-client`, `mcp-profiles`, `mcp-control-plane`, `mcp-host`, `codex`, and `provider-neutral`.

### Fixed
- Reconcile the version drift between `package.json`/lockfile (`0.1.0`) and `server.json`/README status (`0.1.0-alpha.8`) noted since the last release; all version-carrying files now read `0.2.0`.

### Documentation
- Refresh README and `llms.txt` discovery metadata for ControlCenter search phrases, current registry version, and Elmo/ELMO name-collision context.
- Add `.npmignore` so future npm packages keep built `dist/` files while still excluding local logs and generated catalog state.
- Complete `llms.txt` tool list with `controlcenter_list_skills`, `controlcenter_find_skill`, and `controlcenter_list_plugins` (14 of 17 tools were listed).

### i18n
- Skill-finder tool/input descriptions translated for all six supported languages (`de`, `en`, `es`, `zh`, `ja`, `ru`); the `toolText`/`inputText` English fallback remains only as a safety net for any future untranslated key.

## 0.1.0-alpha.8 - 2026-06-17

### Changed
- Add a TTY-guarded `update-notifier` check for interactive CLI starts while keeping MCP stdio output unchanged.

### Fixed
- Align `package.json`, lockfile, MCP runtime version, tool-catalog probe client version, and `server.json` metadata after the update-notifier release.
- Refresh npm dependency locks so the production audit finding for `hono` is resolved.

### Documentation
- Translated ROADMAP.md and STATE.md from German to English for consistency with the English-first project.
- Added Audience, Search Phrases, and Last-checked sections to `llms.txt`.
- Added Homebase (44 tools) and ServerCommander (8 tools) to MCP Server Family table in README.md and README_de.md.
- Updated FileCommander tool count 43→44 in MCP Server Family table.
- Converted `llms.txt` Search Phrases section from bullet list to fenced code block for consistency.
- Updated `llms.txt` Last-checked to 2026-06-11.

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
