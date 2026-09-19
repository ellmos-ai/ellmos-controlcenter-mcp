# Third-Party Licenses / Drittanbieter-Lizenzen

This document lists the third-party open-source software libraries, packages, and components utilized by **ellmos-controlcenter-mcp**, along with their respective license types and copyright notices.

---

## Direct Runtime Dependencies / Direkte Laufzeit-Abhängigkeiten

### 1. `@modelcontextprotocol/sdk`
- **Purpose:** Official Model Context Protocol (MCP) TypeScript SDK for stdio / JSON-RPC server and client interfaces.
- **License:** MIT License
- **Copyright:** (c) Anthropic, PBC
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

- **Audit Date / Prüfdatum:** 2026-09-14
- **Audited By / Prüfer:** Gemini / Antigravity Agent (initial Pfad B audit); Codex release review (2026-09-14)
- **Permissive Open-Source Ratio:** 100% (MIT, Apache-2.0)
- **Copyleft Exposure (GPL / LGPL / AGPL):** 0%
- **Commercial & Local-First Use:** Fully Permitted / Uneingeschränkt zulässig
- **Network Egress / Telemetry:** No telemetry or automatic background update checks; explicit gateway calls may contact configured HTTPS backends.
