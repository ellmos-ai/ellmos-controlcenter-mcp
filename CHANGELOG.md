# Changelog

## Unreleased

### Virtual MCP gateway — ROADMAP Phase 4, partially (2026-08-16)

The deferral recorded in `DECISIONS.md` on 2026-07-23 was lifted by the user on 2026-08-16. Version bumped to `0.5.0` because ControlCenter now sits in the request path, which the `0.4.0` description explicitly denied.

- Add `controlcenter_invoke`: run one tool of a backend MCP server that the current session has **not** loaded, and return its result. This is the point of the whole phase — the default profile can shrink to a few servers while the rest stay reachable on demand, instead of every server being loaded so that its tools exist at all.
- Add `controlcenter_list_available_tools`: report what is reachable without loading it. Optional per-server filter; input schemas are omitted unless `includeSchemas` is set, because schemas otherwise dominate the output.
- Do not require the listing before an invocation. The gateway only pays off if a caller who already knows the tool name can call it in one step; on a wrong tool name the error carries that server's available tool names, so a mistyped guess self-corrects in the same round trip rather than forcing a separate list call.
- Build on the existing MCP client layer in `toolCatalog.ts` rather than adding a second one. Targets, transports, and secret masking are shared, so stdio, Streamable HTTP, and SSE work for the gateway exactly as they already did for tool scanning.
- Connect per call and close in `finally` — no session is held between invocations. A pool would keep stdio child processes alive, and this host's rule is that every system reaps its own children; on Windows `StdioClientTransport.close()` also does not reliably kill grandchildren such as `npx` → `node`. The cost is roughly 200–500 ms per call on a cold server, which is the right trade for servers that are deliberately not loaded. Verified: a full gateway test run leaves no additional node processes behind.
- Fail closed in the way that actually matters here: a server that cannot be asked reports `toolCount: null` and status `unreachable`, never zero tools. A partial listing states `1 von 2 Servern konnten nicht befragt werden` at the top of the output, and an unreadable MCP root or a missing profile is reported as a scope error rather than as an empty server list. Confusing "could not ask" with "nothing found" is the costliest failure class in this system.
- Keep four outcomes apart that would otherwise all read as "it did not work": unknown server (with the known server names), unreachable server, unknown tool (with the available tool names), and a tool error reported by the target. The last one means the gateway delivered correctly and the backend answered with `isError`; it is reported as a target error, not as a ControlCenter failure.
- Add `data/gateway-policy.json` (schema `ellmos.controlcenter.gateway-policy.v1`): `deny` rules with `*` wildcards over server and tool, and an optional `allowlist` mode. `deny` always wins. Override the path with `ELLMOS_GATEWAY_POLICY`.
- Put the fail-closed property on the policy *load*, not on the default. Default mode is `open` because a default-deny gateway is unusable and would push the user to re-add every server to the profile; the real boundary is that only servers declared by the configured MCP root or the named profile can be addressed at all. A malformed, unreadable, or schema-foreign policy file refuses every invocation instead of falling back to allow-all.
- Append every invocation, including refused ones, to a JSONL audit log at `~/.ellmos/controlcenter/gateway-audit.jsonl` (`ELLMOS_GATEWAY_AUDIT_LOG`, or `off`). It records argument **names and count, never argument values**, plus the masked connection command or URL, outcome, delivery, duration, and content-block count — never result content. The audit status is reported back in the tool output, so a failed write is visible rather than silently swallowed; `ELLMOS_GATEWAY_AUDIT_REQUIRED=1` turns a failed write into a refused call.
- Mask token-like values in forwarded error text. A failed spawn echoes its command line back, which can carry a credential in an argument.
- Export `maskSensitiveArgs`, `maskUrl`, and `createTransport` from `toolCatalog.ts` so the gateway reuses the existing masking and transport construction instead of duplicating them.
- Add `test/gateway.test.ts` with 30 tests: policy matching and precedence, malformed-policy refusal, unreadable scope, successful stdio invocation, target `isError` kept apart from gateway failure, unreachable server, unknown server, unknown tool with suggestions, timeout, and the audit log including a check that an argument value never reaches it. Full suite: 164 tests.
- Verified end-to-end against the built server over stdio, not only at module level: a client that never loaded the backend called `controlcenter_invoke` through ControlCenter and received the backend's payload, with the audit log holding the argument key and not its value.
- Scope: only the MCP adapter of `STACK-CAPABILITY-PLAN.md` P3. Module, stack, and folder adapters, the risk-class policy taxonomy, `controlcenter_plan_capability`, connection pooling, and streaming/sampling/resource pass-through remain open and are listed in `ROADMAP.md` and `TODO.md`.
- Correct the package, registry, and `llms.txt` descriptions, which claimed ControlCenter "never sits in the request path" and "never executes a tool on another MCP server". Both statements are now false.

### Catalog discovery (2026-08-13)
- Read the hand-curated MCP catalog `mcps.catalog.v1.json` (schema `ellmos.mcps.v1`) in a new `src/mcpCatalog.ts`. It was the one catalog of the three the server did not know: module and stack discovery already ran off `modules.catalog.json` and `stacks.catalog.json`, but the MCP root was only ever directory-scanned, so `mcp_kind`, persistent state, and per-namespace state ownership were invisible.
- Enrich `controlcenter_list_local_servers` and `controlcenter_status` with two new table columns, kind and own state. Both stay scalar on purpose; the nested fields would not survive a table cell.
- Add `controlcenter_describe_mcp` for the nested facts a table cannot carry: per-namespace state ownership, wrapping, wrap target, target kind, composition, namespace, and npm name. It resolves a server by directory name, catalog id, or npm package name. No existing tool was changed in shape or name.
- Join on the catalog id first and the npm package name second, because a server may publish under a different name than its directory carries — `blender-use-mcp` publishes as `ellmos-blender-use-mcp`.
- Report both join directions instead of silently dropping either side: a scanned server without a catalog entry keeps empty catalog fields, and a catalog entry without a directory is listed separately.
- Degrade instead of failing when a catalog is missing, corrupt, or carries a foreign schema. The output names the reason, so an absent catalog is distinguishable from a server that genuinely holds no state.
- Fix a latent crash: `discoverLocalServerDirectories` called `fs.readdir` without a guard, so a non-existent MCP root threw out of `controlcenter_list_local_servers` and `controlcenter_status`. An unreadable root is now reported as unreadable rather than as an empty result, matching the behaviour the host-register tools already had.
- Make the catalog file configurable through `ELLMOS_MCP_CATALOG`; the default stays `mcps.catalog.v1.json` inside the existing, already configurable MCP root.
- Add `test/mcpCatalog.test.ts` with 10 tests covering enrichment, the absent/corrupt/foreign-schema catalog, both join directions, the npm-name fallback, the unreadable root, the path override, and single-server resolution. Full suite: 134 tests.

### Security (2026-08-11)
- Close all open Dependabot advisories in lockfile (`express-rate-limit` ^8.6.2, `nanoid` ^3.3.17, `fast-uri` ^3.1.5, `hono` ^4.13.0). `npm audit` reports 0 vulnerabilities.

### Added
- Add four read-only tools for this host's own registers: `controlcenter_list_locks`, `controlcenter_check_lock`, `controlcenter_evaluate_permission`, and `controlcenter_list_decisions`. They answer "what applies on this machine right now" — project locks, agent-neutral permissions, and pending user decisions — a question no other tool in the family covered.
- Resolve locks along the whole ancestor chain in `controlcenter_check_lock`: a `LOCK.txt` in a parent directory locks everything beneath it, so the effective lock is reported with its inheritance distance rather than only a file in the same folder. The canonical scanner has no path-scoped query at all, and an ancestor walk answers in milliseconds where a full scan takes minutes.
- Delegate every lock rule — expiry, protected `LOCK.user.*` and `LOCK.condition.*` types that never expire on time, scope parsing, and permission precedence `deny > ask > allow > default` — to the host's canonical Python modules through a thin bridge script, instead of reimplementing them in TypeScript. A second implementation of the lock rules would drift from the spec on its next change, and a lock checker that is quietly wrong is worse than none.
- Fail closed throughout: a missing configuration, absent interpreter, unreadable path, timeout, or unparseable answer yields `unknown` with safe-to-proceed `false`, never a reassuring `clear`. Absence of a permission register yields `unknown` rather than `allow`, because the absence of a rule is not a permission.
- Report an incomplete lock scan as incomplete and name the roots it never reached, rather than presenting a partial result as the full picture. `controlcenter_list_locks` runs under a wall-clock budget checked between roots.
- Report when the decision index is older than its source files, so a stale list is visibly stale.
- Return only identifier, date, title, status, and scope from `controlcenter_list_decisions`; question texts, options, and recommendations stay in the register because they can describe personal circumstances.
- Keep all four tools inert until configured via `ELLMOS_LOCK_SCRIPTS`, `ELLMOS_LOCK_ROOTS`, `ELLMOS_DECISIONS_ROOT`, and `ELLMOS_PYTHON`. On a machine without these registers they report "not configured" instead of guessing or crashing.
- Add `controlcenter_resolve_semantic_route` as a fail-closed adapter between a provider-neutral persona/role map and the current skill inventory.
- Keep semantic role selection with the caller LLM or user, require an explicit second signal before promoting a map candidate, and preserve visible endpoint gaps.
- Validate nested routing-map records, enums, stable IDs, references, and uniqueness before use; source-only or ambiguous skill deployments can no longer become verified live endpoints.

### Documentation
- Align the public description with what the code actually does. The headline noun changes from "MCP control plane" to "MCP administration server" in `README.md`, `README_de.md`, `llms.txt`, `package.json`, `server.json`, and `glama.json`, and each one-line registry description now carries the qualifier that was previously only in the README body: ControlCenter prepares configuration, and does not change running sessions, sit in the request path, execute another server's tools, or enforce permissions.
- Add an explicit scope-boundary paragraph to `README.md`, `README_de.md`, and `llms.txt` that names the write actions and states that ControlCenter owns no domain data.
- Correct the tool count from 20 to 24 in the ecosystem tables of `README.md` and `README_de.md` and in `glama.json` (`tools.count`), then to 28 with the host-register tools; 28 tools are registered in `src/index.ts`.
- Correct the Vitest badge in `README.md` and `README_de.md` from 79 to the verified full-suite count, now 124.
- Document the host registers in `README.md`, `README_de.md`, and `llms.txt`: what they read, that they never write, how they fail closed, the four environment variables, what `controlcenter_list_decisions` deliberately withholds, and why a full lock scan is expensive.
- Refresh `Last-checked` in `llms.txt` to 2026-08-08.
- Describe `controlcenter_list_profiles` and `controlcenter_suggest_profile` in `llms.txt` as provider-neutral, matching the `ELLMOS_PROFILE_ROOT` behaviour already documented in the README.

### Security
- Refresh transitive dependency overrides for `hono`, `fast-uri`, and `ip-address`; `npm audit` reports zero vulnerabilities.

## 0.3.0 - 2026-08-01

### Added
- Add fail-closed `controlcenter_find_capability` and `controlcenter_tool_overview` consumers for hash-consistent System Explorer resolutions.
- Label lexical candidates with method `controlcenter-lexical-candidate` and score domain `controlcenter.lexical.v1`, without selection or execution authority.
- Preserve separate declared, installed, configured, running, healthy, and observed state axes.
- Add the optional, fail-closed `controlcenter_actual_self_receipt` evidence producer.
- Probe the package's own MCP `list_tools` surface without executing tools and sign a redacted runtime readback as `ellmos.actual-self-component-receipt.v1`.
- Pin the host-local Ed25519 private key by SHA-256 and cap receipt TTL at 300 seconds.
- Document the planned optional Claude Code restart/reconnect hint workflow for written profile changes, keeping automatic reconnection behind an explicit fail-closed adapter.

### Security
- Reject content-hash drift, missing registry source-verification claims, declared-only identities, type-prefix mismatches, unstable local-path references, and conflicting duplicate bindings.
- Mark source provenance and component identity unverified until a separately trusted System Explorer receipt exists; self-consistency never upgrades trust.
- Keep producer configuration outside tool inputs, reject foreign host scope, and return no secret, key path, environment, raw tool description, or local path.
- Leave trust-store provisioning and routing activation explicitly outside ControlCenter.

### Maintenance
- Enhanced Discoverability & SEO: added Vitest (79 passed), Ecosystem (`ellmos-ai`), Umbrella (`open-bricks`), and LLM-Ready (`llms.txt`) Shields.io badges to `README.md` & `README_de.md`.
- Added GFM `llms.txt` integration callout banner (`> [!NOTE]`) and interactive Mermaid ControlCenter architecture diagram to English & German documentation.
- Updated `llms.txt` Last-checked verification timestamp and test suite status (79/79 Vitest tests passing).
- Reconciled the public Node.js requirement to >=20 and updated `llms.txt` from the historical 72-test count to the verified 79-test suite.

## 0.2.4 - 2026-07-27

### Enhanced
- Multi-language stopword filtering (`de`, `en`, `es`, `ja`, `ru`, `zh`) in `controlcenter_find_skill` (Stage 1).
- Normalized relevance scoring (`normalizedScore` relative to content terms) in `controlcenter_find_skill` (Stage 2).
- Expanded Vitest test suite (72/72 tests passing).

### Security & Maintenance
- Dependency security audit & overrides updated (0 vulnerabilities across ecosystem).
- Synchronize version string 0.2.4 across `package.json`, `package-lock.json`, `server.json`, `glama.json`, and `src/index.ts`.
- Remove the unverified legacy `smithery.yaml`; current Smithery publication for local stdio servers requires a validated MCPB bundle.

## 0.2.3 - 2026-07-25

### Maintenance & Hygiene (2026-07-27)
- Refresh `llms.txt` header index (`Last-checked: 2026-07-27`) and verify unit test suite state (70/70 tests passing).
- Align status version string `0.2.3` in `README.md` and `README_de.md` to match package version.

### Security & Maintenance
- Remediate `postcss <=8.5.17` high-severity vulnerability (`GHSA-r28c-9q8g-f849`), `fast-uri`, `body-parser`, and `hono` security findings via dependency updates.
- Synchronize version string 0.2.3 across `package.json`, `package-lock.json`, `server.json`, `glama.json`, and `src/index.ts`.
- Verify full test suite (70 tests passing).


## 0.2.2 - 2026-07-24

### Fixed
- Correct FileCommander (46) and CodeCommander (22) tool counts in the ecosystem family table; counts now verified against the live MCP `tools/list` surface.
- Align the McpServer runtime version in `src/index.ts` with package.json (was stuck at 0.1.0-alpha.8).

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
