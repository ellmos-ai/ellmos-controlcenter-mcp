# Third-Party Licenses & Transparency Notice (Level 1 SBOM)

> **Project:** `ellmos-ai/ellmos-controlcenter-mcp`<br>
> **Initial Audit:** 2026-09-14<br>
> **Re-Audit (Pfad A):** 2026-09-26<br>
> **Repository License:** [MIT License](LICENSE)<br>
> **Canonical Notice:** [NOTICE](NOTICE)<br>
> **Architecture & Privacy:** Local-First Administration, Explicit Remote HTTPS Gateway Boundaries, Unprivileged User-Mode (`RunAsInvoker`), Fail-Closed Gateway Policies

---

## Executive Summary & Compliance Assurance

This document lists the third-party open-source software libraries, packages, and components utilized by **ellmos-controlcenter-mcp**, along with their respective license types, copyright notices, and governance compliance mapping.

`ellmos-controlcenter-mcp` is engineered under strict architectural and governance invariants: **Local-First Administration, No Telemetry or Background Egress, Unprivileged User-Mode Execution (`RunAsInvoker`), Fail-Closed Gateway Policy Enforcement, Ephemeral Stdio Child-Process Boundaries, Bounded Secret Scrubbing, and Canonical Multi-Agent Lock/Permission Introspection**.

All direct runtime, optional, and development dependencies utilized across `ellmos-controlcenter-mcp` are distributed under strictly **permissive open-source licenses** (MIT, Apache-2.0). There are **zero AGPL or restrictive copyleft constraints**, ensuring complete safety for multi-agent setups, personal developer machines, enterprise infrastructure, and automated fleet deployments.

---

## Level 1 SBOM Invariant Cross-Reference Matrix

| Invariant Code | Core Requirement | Implementation Mechanism | License / Dependency Impact | Compliance Status |
|:---|:---|:---|:---|:---:|
| `INV-LOCAL-01` | Local-First & Explicit Egress | Dashboard binds strictly to loopback (`127.0.0.1`); no background telemetry or phone-home requests; explicit gateway calls require configured HTTPS backends | `@modelcontextprotocol/sdk` (MIT) | **PASS (Local-First)** |
| `INV-GATE-02` | Fail-Closed Gateway Policy Guard | Gateway tool invocation gated strictly by `data/gateway-policy.json`; missing or invalid policy files refuse every call | `zod` schema validation (MIT) | **PASS (Fail-Closed)** |
| `INV-SUB-03` | Ephemeral Child Process Boundaries | Connect-per-call stdio lifecycle; child processes terminate immediately after tool result delivery (zero zombie processes) | Node.js child_process stdio | **PASS (Ephemeral)** |
| `INV-SCRUB-04` | Bounded Result Redaction & Finite Budgets | Recursive secret scrubbing across payloads; key wiping confined to structured metadata; 256 KiB request & 1 MiB response budgets | Standard TypeScript algorithms | **PASS (Scrubbed & Bounded)** |
| `INV-PRIV-05` | Non-Elevation / RunAsInvoker | Operates strictly within unprivileged standard OS user space without administrative or root elevation | User token execution only | **PASS (RunAsInvoker)** |
| `INV-LOCK-06` | Canonical Multi-Agent Lock Awareness | Respects canonical multi-agent project locks (`LOCK*.txt`, `LOCK.user.*`, `LOCK.until.*`) fail-closed | Host file-based lock protocol | **PASS (Lock-Aware)** |
| `INV-PERM-07` | Nearest Permission Register Introspection | Recursively discovers and evaluates `LOCK.permissions.json` up directory trees | Standard path resolution | **PASS (Fail-Closed)** |
| `INV-GOV-08` | Read-Only Host Governance Federation | Read-only federation of pending decisions, policy registry, strategic plans, and resource inventory | Read-only SQLite / JSON queries | **PASS (Read-Only)** |
| `INV-SYNC-09` | Cloud-Sync Conflict Hardening | `.gitignore` hardened against multi-host conflict copies, temporary files, and lock files | Standard gitignore patterns | **PASS (Sync-Protected)** |
| `INV-SLA-10` | 48h Security SLA & Coordinated Disclosure | Binding 48-hour response confirmation and 5-day triage commitment via canonical security channels (`security@open-bricks.org`, `security@ellmos.ai`) | Contractual SLA commitment | **PASS (Contractual)** |

---

## Direct Runtime Dependencies / Direkte Laufzeit-Abhängigkeiten

### 1. `@modelcontextprotocol/sdk`
- **Purpose:** Official Model Context Protocol (MCP) TypeScript SDK for stdio / JSON-RPC server and client interfaces.
- **License:** MIT License
- **Copyright:** (c) 2024-2026 Anthropic, PBC
- **Repository:** https://github.com/modelcontextprotocol/typescript-sdk
- **SPDX Identifier:** `MIT`

```text
MIT License

Copyright (c) 2024-2026 Anthropic, PBC

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

### 2. `zod`
- **Purpose:** TypeScript-first schema declaration and runtime validation library used for MCP tool argument schemas and config validation.
- **License:** MIT License
- **Copyright:** (c) 2020 Colin McDonnell
- **Repository:** https://github.com/colinhacks/zod
- **SPDX Identifier:** `MIT`

```text
MIT License

Copyright (c) 2020 Colin McDonnell

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## Direct Development Dependencies / Entwicklungs-Abhängigkeiten

### 3. `typescript`
- **Purpose:** TypeScript language compiler and static type checking.
- **License:** Apache License 2.0
- **Copyright:** (c) Microsoft Corporation
- **Repository:** https://github.com/microsoft/TypeScript
- **SPDX Identifier:** `Apache-2.0`

### 4. `vitest` & `vite`
- **Purpose:** Unit-test runner and its explicitly constrained Node-18-compatible build tool peer.
- **License:** MIT License
- **Copyright:** Vitest and Vite contributors
- **Repositories:** https://github.com/vitest-dev/vitest and https://github.com/vitejs/vite
- **SPDX Identifier:** `MIT`

### 5. `@types/node`
- **Purpose:** TypeScript type definitions for the Node.js runtime.
- **License:** MIT License
- **Repository:** https://github.com/DefinitelyTyped/DefinitelyTyped
- **SPDX Identifier:** `MIT`

### 6. `@emnapi/core` & `@emnapi/runtime`
- **Purpose:** Development-time native/WASI compatibility dependencies used by the test toolchain.
- **License:** MIT License
- **Repository:** https://github.com/toyobayashi/emnapi
- **SPDX Identifier:** `MIT`

---

## Compliance & Audit Summary / Lizenz- & Audit-Übersicht

- **Audit Date / Prüfdatum:** 2026-09-14 (Initial Pfad B Audit); 2026-09-26 (Pfad A Technical Hygiene Re-Audit)
- **Audited By / Prüfer:** Gemini / Antigravity Agent (One Repo Cleaner Pfad A); Codex release review (2026-09-14)
- **Canonical Attribution Notice:** Root [NOTICE](NOTICE) file declares copyright (c) 2026 Lukas Geiger, open-bricks and ellmos-ai ecosystems
- **Permissive Open-Source Ratio:** 100% (MIT, Apache-2.0)
- **Copyleft Exposure (GPL / LGPL / AGPL):** 0%
- **Commercial & Local-First Use:** Fully Permitted / Uneingeschränkt zulässig
- **Network Egress / Telemetry:** No telemetry or automatic background update checks; explicit gateway calls may contact configured HTTPS backends
- **Non-Elevation Certification:** Operates in unprivileged user space (`RunAsInvoker`), zero administrative privileges required
