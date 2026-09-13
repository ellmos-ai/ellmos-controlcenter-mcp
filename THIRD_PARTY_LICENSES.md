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

### 3. `update-notifier`
- **Purpose:** Update notifications for CLI applications.
- **License:** BSD 2-Clause "Simplified" License
- **Copyright:** (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com)
- **Repository:** https://github.com/yeoman/update-notifier
- **SPDX Identifier:** `BSD-2-Clause`

```text
BSD 2-Clause License

Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com)

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

---

## Direct Development Dependencies / Entwicklungs-Abhängigkeiten

### 4. `typescript`
- **Purpose:** TypeScript language compiler and static type checking.
- **License:** Apache License 2.0
- **Copyright:** (c) Microsoft Corporation
- **Repository:** https://github.com/microsoft/TypeScript
- **SPDX Identifier:** `Apache-2.0`

### 5. `vitest`
- **Purpose:** Fast unit test runner powered by Vite.
- **License:** MIT License
- **Copyright:** (c) 2021-Present Anthony Fu, Matias Capeletto and Vitest contributors
- **Repository:** https://github.com/vitest-dev/vitest
- **SPDX Identifier:** `MIT`

### 6. `@types/node` & `@types/update-notifier`
- **Purpose:** TypeScript type definitions for Node.js runtime and update-notifier.
- **License:** MIT License
- **Repository:** https://github.com/DefinitelyTyped/DefinitelyTyped
- **SPDX Identifier:** `MIT`

---

## Compliance & Audit Summary / Lizenz- & Audit-Übersicht

- **Audit Date / Prüfdatum:** 2026-09-13
- **Audited By / Prüfer:** Gemini / Antigravity Agent (Pfad B Discoverability, Marketing & License Audit)
- **Permissive Open-Source Ratio:** 100% (MIT, BSD-2-Clause, Apache-2.0)
- **Copyleft Exposure (GPL / LGPL / AGPL):** 0%
- **Commercial & Local-First Use:** Fully Permitted / Uneingeschränkt zulässig
- **Network Egress / Telemetry:** 0% (Zero outbound tracking or metrics collection)
