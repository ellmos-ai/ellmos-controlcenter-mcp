# Security Policy / Sicherheitsrichtlinie

[English](#english) | [Deutsch](#deutsch)

---

<a name="english"></a>
## English

### Alpha Status

`ellmos-controlcenter-mcp` is currently an alpha-stage Model Context Protocol (MCP) administration server and control plane. It inspects local profiles, prepares generated MCP configs, catalogs local MCP servers, resolves capability bundles, and provides a policy-gated gateway to invoke tools on unloaded backend servers.

### Zero-Egress & Local-First Guarantees

- **100% Local-First Execution:** All profile resolution, catalog indexing, and bundle evaluations run entirely on the local host machine.
- **Zero-Egress by Default:** ControlCenter sends zero telemetry, analytics, or background outbound network calls.
- **Loopback Dashboard Binding:** The local administration dashboard strictly binds to `127.0.0.1:3737` by default. It is not exposed to the local network or internet.
- **Non-Elevation (User-Mode Only):** The server operates strictly in unprivileged user space. It never requests or requires administrative/root privileges (`sudo` / UAC elevation).

### Gateway Safety Model & Eigendark Invariants

Since version 0.5.0, ControlCenter includes a policy-gated gateway (`controlcenter_invoke` and `controlcenter_list_available_tools`):

1. **Policy-Gated Dispatch:** All forwarded invocations are checked against `data/gateway-policy.json` (or `ELLMOS_GATEWAY_POLICY`). Deny rules with wildcard matching always take precedence. Malformed or missing policy files fail closed (refuse all calls).
2. **Connect-per-Call Isolation:** Backend processes are spawned per invocation and terminated immediately upon completion in a `finally` block, preventing lingering zombie processes.
3. **Recursive Credential Redaction:** Forwarded outputs undergo recursive secret scrubbing across all nesting levels. Known secret patterns (`sk-…`, `ghp_…`, `github_pat_…`, `AKIA…`, `xox…`, JWTs, `AIza…`) are redacted everywhere. Key-based wiping (`token`, `apiKey`, `password`, `cookie`, `private_key`) is applied only inside structured metadata to avoid altering requested file contents.
4. **Finite Resource Budgets:** Hard limits prevent resource exhaustion:
   - Request bytes: 256 KiB (`ELLMOS_GATEWAY_MAX_REQUEST_BYTES`)
   - Response bytes: 1 MiB (`ELLMOS_GATEWAY_MAX_RESPONSE_BYTES`)
   - Nesting depth: 32 (`ELLMOS_GATEWAY_MAX_DEPTH`)
   - Content blocks: 200 (`ELLMOS_GATEWAY_MAX_CONTENT_BLOCKS`)
   - Concurrent slots: 4 (`ELLMOS_GATEWAY_MAX_CONCURRENT`)
5. **Transport Security:** Remote backend targets must use HTTPS. Plain HTTP is restricted strictly to loopback (`127.0.0.1` / `localhost`). HTTP redirects on gateway calls are refused (`redirect: "error"`) to prevent credential leakage.
6. **Untrusted Data Marking:** Forwarded payloads are wrapped with explicit data banners in text outputs to prevent prompt injection and instruction hijacking.
7. **Structured Audit Logging:** Every invocation attempt is logged to `gateway-audit.jsonl` recording timestamps, server names, tool names, argument **names and count (never argument values)**, duration, and redaction counts.

### Host Register Safety & Signed Receipts

- **Read-Only Host Registers:** Tools inspecting locks, permissions, and decisions are strictly read-only and fail closed (`unknown` instead of `clear` when unconfigured).
- **Signed Runtime Receipts:** `controlcenter_actual_self_receipt` requires explicit host-local configuration, pins Ed25519 keys by SHA-256, redacts error details at the MCP boundary, and never provisions trust or authorizes execution.

### Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **GitHub Security Advisories:** Open a private advisory via [GitHub Security Advisories](https://github.com/ellmos-ai/ellmos-controlcenter-mcp/security/advisories)
2. **Security Contact:** Email us directly:
   - `security@ellmos.ai`
   - `support@lukasgeiger.com`
   - `lukas@open-bricks.org`
3. **Issue Tracker (Non-Sensitive Only):** [GitHub Issues](https://github.com/ellmos-ai/ellmos-controlcenter-mcp/issues)

---

<a name="deutsch"></a>
## Deutsch

### Alpha-Status

`ellmos-controlcenter-mcp` ist ein Administrationsserver und eine Control-Plane für das Model Context Protocol (MCP) im Alpha-Stadium. Das System entdeckt lokale MCP-Server, liest MCP-Profildateien, empfiehlt Capability-Bundles, erzeugt Konfigurationen und bietet ein richtliniengesteuertes Gateway zur Ausführung von Tools auf ungeladenen Backend-Servern.

### Local-First- & Zero-Egress-Garantien

- **100% Lokale Ausführung:** Sämtliche Profilauflösungen, Katalogscans und Bundle-Zuordnungen erfolgen vollständig auf dem lokalen Host-Rechner.
- **Zero-Egress-Garantie:** ControlCenter sendet keinerlei Telemetrie, Trackingdaten oder ungeprüfte ausgehende Netzwerkpakete.
- **Loopback Dashboard-Bindung:** Das lokale Administrations-Dashboard bindet standardmäßig ausschließlich an `127.0.0.1:3737` und ist weder im LAN noch im Internet exponiert.
- **Keine Administratorrechte (User-Mode):** Der Server arbeitet vollständig im unprivilegierten Benutzermodus und benötigt niemals Administrator- oder Root-Rechte.

### Gateway-Sicherheitsmodell & Eigendark-Invarianten

Seit Version 0.5.0 verfügt ControlCenter über ein richtliniengesteuertes Gateway (`controlcenter_invoke` und `controlcenter_list_available_tools`):

1. **Richtliniengesteuerte Steuerung:** Alle weitergeleiteten Aufrufe werden gegen `data/gateway-policy.json` (oder `ELLMOS_GATEWAY_POLICY`) geprüft. `deny`-Regeln mit Wildcard-Mustern haben stets Vorrang. Fehlerhafte oder fehlende Richtliniendateien blockieren alle Aufrufe (Fail-Closed).
2. **Connect-per-Call-Isolation:** Backend-Prozesse werden pro Aufruf gestartet und unmittelbar nach Abschluss im `finally`-Block beendet, um verwaiste Hintergrundprozesse zu verhindern.
3. **Rekursive Geheimnis-Schwärzung:** Ausgaben werden über alle Verschachtelungsebenen hinweg bereinigt. Spezifische Secret-Muster (`sk-…`, `ghp_…`, `github_pat_…`, `AKIA…`, `xox…`, JWTs, `AIza…`) werden überall ersetzt. Schlüsselbasierte Schwärzungen (`token`, `apiKey`, `password`, `cookie`, `private_key`) greifen nur in strukturierten Metadaten, um angeforderte Dateiinhalte nicht zu verfälschen.
4. **Finite Ressourcenbudgets:** Harte Begrenzungen schützen vor Ressourcenerschöpfung:
   - Anfragegröße: max. 256 KiB (`ELLMOS_GATEWAY_MAX_REQUEST_BYTES`)
   - Antwortgröße: max. 1 MiB (`ELLMOS_GATEWAY_MAX_RESPONSE_BYTES`)
   - Verschachtelungstiefe: max. 32 (`ELLMOS_GATEWAY_MAX_DEPTH`)
   - Inhaltsblöcke: max. 200 (`ELLMOS_GATEWAY_MAX_CONTENT_BLOCKS`)
   - Parallele Aufrufe: max. 4 Slots (`ELLMOS_GATEWAY_MAX_CONCURRENT`)
5. **Transportsicherheit:** Entfernte Backend-Ziele müssen HTTPS verwenden. Unverschlüsseltes HTTP ist strikt auf Loopback (`127.0.0.1` / `localhost`) beschränkt. HTTP-Redirects bei Gateway-Aufrufen werden verweigert (`redirect: "error"`).
6. **Kennzeichnung unvertrauenswürdiger Daten:** Weitergeleitete Daten werden in Textausgaben mit expliziten Bannern umschlossen, um Prompt-Injection und Anweisungsübernahme zu verhindern.
7. **Strukturiertes Audit-Logging:** Jeder Aufrufversuch wird in `gateway-audit.jsonl` protokolliert — mit Zeitstempel, Server, Tool, Argument-**Namen und -Anzahl (niemals Argument-Werte)**, Laufzeit und Schwärzungszähler.

### Meldung von Sicherheitslücken

Sicherheitsrelevante Schwachstellen melden Sie bitte vertraulich über:

1. **GitHub Security Advisories:** [GitHub Security Advisories](https://github.com/ellmos-ai/ellmos-controlcenter-mcp/security/advisories)
2. **Direkter Sicherheitskontakt:**
   - `security@ellmos.ai`
   - `support@lukasgeiger.com`
   - `lukas@open-bricks.org`
3. **Öffentlicher Issue Tracker (nur unkritische Fragen):** [GitHub Issues](https://github.com/ellmos-ai/ellmos-controlcenter-mcp/issues)

