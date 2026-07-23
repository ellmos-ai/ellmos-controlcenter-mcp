# ellmos ControlCenter MCP

<p align="center">
  <img src="assets/controlcenter-logo.jpg" alt="ellmos ControlCenter MCP logo" width="420">
</p>

**DE [Deutsche Version](README_de.md)**

*Part of the [ellmos-ai](https://github.com/ellmos-ai) family.*

[![npm version](https://img.shields.io/npm/v/ellmos-controlcenter-mcp.svg)](https://www.npmjs.com/package/ellmos-controlcenter-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org/)

An alpha-stage **Model Context Protocol (MCP) control plane** for local MCP stacks. ControlCenter discovers local MCP servers, reads MCP profile files, groups servers into capability bundles, recommends profiles for a task, builds catalogs, probes real MCP tool lists from local repositories or profiles, assigns tools to capability bundles, and provides an optional local dashboard.

> **Provider note:** ControlCenter works with any MCP-capable client (Claude Code, Codex, Gemini, or any stdio-based MCP host). The profile management tools default to Claude Code's profile directory (`~/.claude/profiles`) but accept any directory via `ELLMOS_PROFILE_ROOT`. The skill and plugin inventory tools are scoped to Claude Code conventions by default; see the environment variables below for override options.

The first alpha release focuses on **discovery, profile visibility, dashboard workflows, capability bundles, profile-aware tool-list probes, tool-bundle assignments, internationalization, and initial policy audits**. Gateway mode, enforced tool-level permissions, authentication, and hard security boundaries are planned, but are not implemented yet.

> **Alpha note:** This version is useful for local administration and preview testing. It is not a hardened MCP gateway and should not be used as a security layer for untrusted tools or other users.

## Status

- **Phase:** Alpha
- **Version:** `0.2.0`
- **Repository:** [`ellmos-ai/ellmos-controlcenter-mcp`](https://github.com/ellmos-ai/ellmos-controlcenter-mcp)
- **npm:** [`ellmos-controlcenter-mcp`](https://www.npmjs.com/package/ellmos-controlcenter-mcp)
- **CI checks:** `npm run test` and `npm run build`
- **Goal:** Make local MCP stacks visible, inspectable, and easier to control
- **Focus:** Catalogs, profile overview, profile recommendation, bundle recommendation, profile-aware tool-list probes, tool-bundle assignments, i18n, and early audits

## Tools

| Tool | Purpose |
|---|---|
| `controlcenter_status` | Show stack, profile, and detected-server status |
| `controlcenter_get_language` | Show the current ControlCenter output language |
| `controlcenter_set_language` | Set the ControlCenter output language for this running server instance |
| `controlcenter_list_local_servers` | Scan local MCP repositories below the MCP root |
| `controlcenter_list_stacks` | Read registered stacks from `stacks.catalog.json` and validate their `ellmos.stack.v2` manifests |
| `controlcenter_describe_stack` | Describe typed components, roles, policies, and validation warnings for one registered stack |
| `controlcenter_context_pack` | Build a bounded, manifest-only handoff for a registered stack at `short`, `execution`, or `full` detail |
| `controlcenter_list_tools` | Start local or profile-defined MCP servers and read their real `list_tools` output |
| `controlcenter_assign_tool_bundles` | Assign probed MCP tools to capability bundles |
| `controlcenter_list_bundles` | Group local servers by capability bundle |
| `controlcenter_suggest_bundles` | Recommend bundles for a task |
| `controlcenter_list_profiles` | List MCP profiles from the profile root (defaults to `~/.claude/profiles`; override with `ELLMOS_PROFILE_ROOT`) |
| `controlcenter_suggest_profile` | Recommend a profile for a task |
| `controlcenter_resolve_profile` | Resolve a profile including `extends` chains |
| `controlcenter_switch_profile` | Prepare a generated `--mcp-config` file and configurable launch command |
| `controlcenter_audit_profile` | Run initial policy checks against a profile |
| `controlcenter_build_catalog` | Build a JSON catalog of local MCP servers, optionally including tool probes |
| `controlcenter_list_skills` | Inventory deployed skills (`~/.claude/skills` by default; Claude Code convention, override with `ELLMOS_SKILLS_ROOT`) and the source skills library |
| `controlcenter_find_skill` | Match a free-text task or intent against the scanned skill catalogue and return ranked candidates |
| `controlcenter_list_plugins` | Inventory installed plugins (`~/.claude/plugins` by default; Claude Code convention, override with `ELLMOS_PLUGINS_ROOT`) and local ellmos modules |

## Dashboard

After building the project, start the local dashboard with:

```bash
npm run dashboard
```

Default address:

```text
http://127.0.0.1:3737
```

The dashboard can currently show local servers and profiles, switch its UI language, enable or disable servers per profile, summarize profile audits, scan MCP tools for the selected profile or local repositories, display tool-to-bundle assignments, and write a generated `--mcp-config` file. Write actions ask for confirmation and create a backup before overwriting an existing file.

## Discovery and Registry Metadata

ControlCenter ships MCP registry metadata for crawlers and catalog tools:

- `server.json` uses the official MCP server metadata shape with the package name, repository, and stdio transport.
- `llms.txt` gives LLM crawlers a compact project summary, canonical links, and tool overview.
- `package.json` includes both files in the npm package so registry indexers can read the same metadata from GitHub or npm.

The public npm package is the canonical install target. The GitHub repository remains the canonical source for development, issues, and release notes.

## Search and Discovery Context

Use the full name **ellmos ControlCenter MCP** or the package name `ellmos-controlcenter-mcp` when linking or searching. The short phrase "control center" is too broad, and "ellmos" can collide with Elmo/ELMO motion-control, HR, and voice-generator results.

Best-fit search phrases:

- `ellmos ControlCenter MCP`
- `ellmos-controlcenter-mcp`
- `MCP control plane for local servers`
- `MCP profile management dashboard`
- `local MCP stack discovery TypeScript`
- `Claude Codex Gemini MCP profile switcher`
- `MCP policy audit profile management`

## Installation

### Option 1: Install from npm

```bash
npm install -g ellmos-controlcenter-mcp
```

Start the MCP server:

```bash
ellmos-controlcenter
```

Start the dashboard:

```bash
ellmos-controlcenter-dashboard
```

### Option 2: Install from source

```bash
git clone https://github.com/ellmos-ai/ellmos-controlcenter-mcp.git
cd ellmos-controlcenter-mcp
npm install
npm run build
```

Run the server from source:

```bash
node dist/index.js
```

Run the dashboard from source:

```bash
node dist/dashboard.js
```

## Configuration

### MCP Client Configuration

ControlCenter works with any MCP-capable client. The JSON snippet below uses the standard `mcpServers` format supported by Claude Code, Claude Desktop, Codex, Cursor, and other MCP hosts.

If installed globally from npm:

```json
{
  "mcpServers": {
    "controlcenter": {
      "command": "ellmos-controlcenter"
    }
  }
}
```

If installed from source:

```json
{
  "mcpServers": {
    "controlcenter": {
      "command": "node",
      "args": [
        "/absolute/path/to/ellmos-controlcenter-mcp/dist/index.js"
      ]
    }
  }
}
```

Optional environment variables:

- `ELLMOS_MCP_ROOT` overrides the default MCP repository root
- `ELLMOS_STACKS_ROOT` overrides the stack catalog root (default: local `.AI/.STACKS`)
- `ELLMOS_PROFILE_ROOT` overrides the profile directory (default: `~/.claude/profiles`)
- `ELLMOS_SKILLS_ROOT` overrides the deployed skills directory (default: `~/.claude/skills`)
- `ELLMOS_PLUGINS_ROOT` overrides the plugins directory (default: `~/.claude/plugins`)
- `ELLMOS_BUNDLE_CONFIG` overrides the capability bundle definition file
- `ELLMOS_POLICY_CONFIG` overrides the profile audit policy rule file
- `ELLMOS_LAUNCH_TEMPLATE` overrides the generated profile-switch launch command. Use `{config}` as placeholder for the generated MCP config path.
- `CONTROLCENTER_LANGUAGE` or `ELLMOS_CONTROLCENTER_LANGUAGE` sets the initial output language

By default, the MCP repository root is derived from the `OneDrive`/`ONEDRIVE` environment variable and falls back to `~/OneDrive/.TOPICS/.AI/.MCP`.

## Internationalization

ControlCenter supports the language codes `de`, `en`, `es`, `zh`, `ja`, and `ru`. All six languages now have maintained text sets for MCP tool output, dashboard labels, policy hints, profile recommendations, and tool descriptions.

Use `controlcenter_get_language` to inspect the current language and `controlcenter_set_language` to switch MCP tool output at runtime. The dashboard also includes a language selector and accepts `/?lang=en` style links. Bundle titles and descriptions loaded from custom JSON config files are shown as authored.

## Profile Switching

`controlcenter_switch_profile` does not change a running session. It creates a resolved MCP configuration and returns a launch command. The default remains compatible with Claude Code:

```bash
claude --mcp-config ~/.claude/profiles/_generated/software.mcp.json
```

With `write: false`, the switch runs as a preview. With `write: true`, ControlCenter writes the generated file. The generated `mcpServers` JSON is readable by any MCP-capable client. Use the `launchTemplate` input or `ELLMOS_LAUNCH_TEMPLATE` to return a Codex, Gemini, or custom launcher command, for example `codex mcp run --config {config}`.

Profile resolution supports single inheritance (`"extends": "base"`), multiple inheritance (`"extends": ["base", "shared"]`), and inherited-server removal via `"remove"`, `"disabled"`, or `"disabledServers"`. Missing profiles, invalid JSON, invalid profile names, and inheritance cycles now return explicit profile errors with the affected file path or chain.

## Capability Bundles

ControlCenter loads capability bundle definitions from `data/capability-bundles.json`. The default file groups local servers into these bundles:

- `core-local`
- `software`
- `filesystem`
- `automation`
- `control-plane`

Custom bundle files can be supplied with `ELLMOS_BUNDLE_CONFIG` or with the optional `bundleConfigPath` input on bundle tools. A bundle file is a JSON object with `schemaVersion` and a `bundles` array. Each bundle needs `id`, `title`, `description`, and `keywords`.

This is the basis for future tool-bloat management: instead of exposing many individual tools immediately, an agent can first choose the capability bundle that fits the task.

## Tool Catalog

`controlcenter_list_tools` can start local stdio MCP servers or resolved Claude profile servers and call the standard MCP `list_tools` request. Profile scans support arbitrary stdio commands, including non-Node launchers, and URL-based remote configs using Streamable HTTP or legacy SSE. The scan is explicit, uses a per-server timeout, does not call any reported tool, and closes each spawned local server after reading the tool list.

`controlcenter_build_catalog` accepts `includeTools: true` to persist the same probe results alongside the local server catalog.

`controlcenter_assign_tool_bundles` compares probed tool names, titles, descriptions, server names, source, and transport metadata with capability-bundle keywords, then reports which tools belong to bundles such as filesystem, software, automation, or control plane.

## Profile Audit

`controlcenter_audit_profile` is the first small policy layer. It currently flags:

- `npx` starts
- environment variables in server configurations
- missing or invalid server commands
- sensitive name fragments in arguments

Environment values are never printed.

Policy rules are loaded from `data/policy-rules.json` by default. The file can disable individual rules or override their severity, and `controlcenter_audit_profile` also accepts a `policyConfigPath` input for one-off audits.

## Project Structure

```text
ellmos-controlcenter-mcp/
|-- src/
|-- test/
|-- data/
|-- README.md
|-- README_de.md
|-- START.md
|-- ARCHITECTURE.md
|-- STATE.md
|-- DECISIONS.md
`-- TODO.md
```

## Documentation

| For... | Read... |
|---|---|
| Quick start | [START.md](./START.md) |
| Current state | [STATE.md](./STATE.md) |
| Architecture | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| Roadmap | [ROADMAP.md](./ROADMAP.md) |
| Decisions | [DECISIONS.md](./DECISIONS.md) |
| Open tasks | [TODO.md](./TODO.md) |
| Changes | [CHANGELOG.md](./CHANGELOG.md) |
| LLM crawler summary | [llms.txt](./llms.txt) |

## ellmos-ai Ecosystem

This MCP server is part of the **[ellmos-ai](https://github.com/ellmos-ai)** ecosystem — AI infrastructure, MCP servers, and intelligent tools.

### MCP Server Family

| Server | Tools | Focus | npm |
|--------|-------|-------|-----|
| [FileCommander](https://github.com/ellmos-ai/ellmos-filecommander-mcp) | 45 | Filesystem, process management, interactive sessions, cloud-lock-safe operations | [`ellmos-filecommander-mcp`](https://www.npmjs.com/package/ellmos-filecommander-mcp) |
| [CodeCommander](https://github.com/ellmos-ai/ellmos-codecommander-mcp) | 18 | Code analysis, JSON repair, imports, diffs, regex | [`ellmos-codecommander-mcp`](https://www.npmjs.com/package/ellmos-codecommander-mcp) |
| [Clatcher](https://github.com/ellmos-ai/ellmos-clatcher-mcp) | 12 | File repair, format conversion, batch operations | [`ellmos-clatcher-mcp`](https://www.npmjs.com/package/ellmos-clatcher-mcp) |
| [n8n Manager](https://github.com/ellmos-ai/n8n-manager-mcp) | 18 | n8n workflow management via AI assistants | [`n8n-manager-mcp`](https://www.npmjs.com/package/n8n-manager-mcp) |
| **[ControlCenter](https://github.com/ellmos-ai/ellmos-controlcenter-mcp)** | **20** | **MCP stack discovery, profile management, control plane** | **[`ellmos-controlcenter-mcp`](https://www.npmjs.com/package/ellmos-controlcenter-mcp)** |
| [Homebase](https://github.com/ellmos-ai/ellmos-homebase-mcp) | 45 | Local-first LLM memory, knowledge, state, routing, swarm orchestration | [`ellmos-homebase-mcp`](https://www.npmjs.com/package/ellmos-homebase-mcp) (alpha) |
| [ServerCommander](https://github.com/ellmos-ai/ellmos-servercommander-mcp) | 8 | Server operations: health checks, log analysis, deploy dry-runs, mail diagnostics | [`ellmos-servercommander-mcp`](https://www.npmjs.com/package/ellmos-servercommander-mcp) (alpha) |
| [Blender Use](https://github.com/ellmos-ai/ellmos-blender-use-mcp) | 3 | Headless Blender asset QA and FBX reimport verification | [`ellmos-blender-use-mcp`](https://www.npmjs.com/package/ellmos-blender-use-mcp) (alpha) |
| [Open Compute](https://github.com/ellmos-ai/open-compute-mcp) | 10 | Model-agnostic computer use: capture, safety-gated actions, Windows UIA | [`open-compute-mcp`](https://www.npmjs.com/package/open-compute-mcp) (alpha) |

### AI Infrastructure

| Project | Description |
|---------|-------------|
| [BACH](https://github.com/ellmos-ai/bach) | Local-first text-based OS for LLM agents — 113+ handlers, 550+ tools, SQLite memory |
| [open-compute](https://github.com/ellmos-ai/open-compute) | Model-agnostic computer-use core powering Open Compute MCP |
| [clutch](https://github.com/ellmos-ai/clutch) | Provider-neutral LLM orchestration with auto-routing and budget tracking |
| [rinnsal](https://github.com/ellmos-ai/rinnsal) | Lightweight agent memory, connectors, and automation infrastructure |
| [ellmos-stack](https://github.com/ellmos-ai/ellmos-stack) | Self-hosted AI research stack (Ollama + n8n + Rinnsal + KnowledgeDigest) |
| [MarbleRun](https://github.com/ellmos-ai/MarbleRun) | Autonomous agent chain framework for Claude Code |
| [gardener](https://github.com/ellmos-ai/gardener) | Minimalist database-driven LLM OS prototype (4 functions, 1 table) |
| [ellmos-tests](https://github.com/ellmos-ai/ellmos-tests) | Testing framework for LLM operating systems (7 dimensions) |

### Desktop Software

Our partner organization **[open-bricks](https://github.com/open-bricks)** bundles AI-native desktop applications — a modern, open-source software suite built for the age of AI. Categories include file management, document tools, developer utilities, and more.

## License

[MIT](LICENSE) - Lukas Geiger ([ellmos-ai](https://github.com/ellmos-ai))
