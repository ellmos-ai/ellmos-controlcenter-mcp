# ellmos ControlCenter MCP

<p align="center">
  <img src="assets/controlcenter-logo.jpg" alt="ellmos ControlCenter MCP logo" width="420">
</p>

**🇩🇪 [Deutsche Version](README_de.md)**

*Part of the [ellmos-ai](https://github.com/ellmos-ai) family.*

[![npm version](https://img.shields.io/npm/v/ellmos-controlcenter-mcp.svg)](https://www.npmjs.com/package/ellmos-controlcenter-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org/)

An alpha-stage **Model Context Protocol (MCP) control plane** for local MCP stacks. ControlCenter discovers local MCP servers, reads Claude profile files, groups servers into capability bundles, recommends profiles for a task, builds catalogs, and provides an optional local dashboard.

The first alpha release focuses on **discovery, profile visibility, dashboard workflows, capability bundles, and initial policy audits**. Gateway mode, enforced tool-level permissions, authentication, and hard security boundaries are planned, but are not implemented yet.

> **Alpha note:** This version is useful for local administration and preview testing. It is not a hardened MCP gateway and should not be used as a security layer for untrusted tools or other users.

## Status

- **Phase:** Alpha
- **Version:** `0.1.0-alpha.2`
- **Repository:** [`ellmos-ai/ellmos-controlcenter-mcp`](https://github.com/ellmos-ai/ellmos-controlcenter-mcp)
- **npm:** [`ellmos-controlcenter-mcp`](https://www.npmjs.com/package/ellmos-controlcenter-mcp)
- **CI checks:** `npm run test` and `npm run build`
- **Goal:** Make local MCP stacks visible, inspectable, and easier to control
- **Focus:** Catalogs, profile overview, profile recommendation, bundle recommendation, and early audits

## Tools

| Tool | Purpose |
|---|---|
| `controlcenter_status` | Show stack, profile, and detected-server status |
| `controlcenter_list_local_servers` | Scan local MCP repositories below the MCP root |
| `controlcenter_list_bundles` | Group local servers by capability bundle |
| `controlcenter_suggest_bundles` | Recommend bundles for a task |
| `controlcenter_list_profiles` | List Claude profiles from the profile root |
| `controlcenter_suggest_profile` | Recommend a profile for a task |
| `controlcenter_resolve_profile` | Resolve a profile including `extends` chains |
| `controlcenter_switch_profile` | Prepare a generated `--mcp-config` file |
| `controlcenter_audit_profile` | Run initial policy checks against a profile |
| `controlcenter_build_catalog` | Build a JSON catalog of local MCP servers |

## Dashboard

After building the project, start the local dashboard with:

```bash
npm run dashboard
```

Default address:

```text
http://127.0.0.1:3737
```

The dashboard can currently show local servers and profiles, enable or disable servers per profile, summarize profile audits, and write a generated `--mcp-config` file. Write actions ask for confirmation and create a backup before overwriting an existing file.

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

### Claude Desktop / Claude Code

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
- `ELLMOS_PROFILE_ROOT` overrides the Claude profile directory

## Profile Switching

`controlcenter_switch_profile` does not change a running Claude session. It creates a resolved MCP configuration and returns a launch command:

```bash
claude --mcp-config ~/.claude/profiles/_generated/software.mcp.json
```

With `write: false`, the switch runs as a preview. With `write: true`, ControlCenter writes the generated file.

## Capability Bundles

ControlCenter currently groups local servers into these bundles:

- `core-local`
- `software`
- `filesystem`
- `automation`
- `control-plane`

This is the basis for future tool-bloat management: instead of exposing many individual tools immediately, an agent can first choose the capability bundle that fits the task.

## Profile Audit

`controlcenter_audit_profile` is the first small policy layer. It currently flags:

- `npx` starts
- environment variables in server configurations
- missing or invalid server commands
- sensitive name fragments in arguments

Environment values are never printed.

## Project Structure

```text
ellmos-controlcenter-mcp/
├── src/
├── test/
├── data/
├── README.md
├── README_de.md
├── START.md
├── ARCHITECTURE.md
├── STATE.md
├── DECISIONS.md
└── TODO.md
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

## ellmos-ai Ecosystem

This MCP server is part of the **[ellmos-ai](https://github.com/ellmos-ai)** ecosystem: AI infrastructure, MCP servers, and intelligent tools.

### MCP Server Family

| Server | Tools | Focus | npm |
|--------|-------|-------|-----|
| [FileCommander](https://github.com/ellmos-ai/ellmos-filecommander-mcp) | 43 | Filesystem, process management, interactive sessions | [`ellmos-filecommander-mcp`](https://www.npmjs.com/package/ellmos-filecommander-mcp) |
| [CodeCommander](https://github.com/ellmos-ai/ellmos-codecommander-mcp) | 17 | Code analysis, AST parsing, import management | [`ellmos-codecommander-mcp`](https://www.npmjs.com/package/ellmos-codecommander-mcp) |
| [Clatcher](https://github.com/ellmos-ai/ellmos-clatcher-mcp) | 12 | File repair, format conversion, batch operations | [`ellmos-clatcher-mcp`](https://www.npmjs.com/package/ellmos-clatcher-mcp) |
| [n8n Manager](https://github.com/ellmos-ai/n8n-manager-mcp) | 18 | n8n workflow management via AI assistants | [`n8n-manager-mcp`](https://www.npmjs.com/package/n8n-manager-mcp) |
| **[ControlCenter](https://github.com/ellmos-ai/ellmos-controlcenter-mcp)** | **10** | **MCP stack discovery, profile management, control plane** | **[`ellmos-controlcenter-mcp`](https://www.npmjs.com/package/ellmos-controlcenter-mcp)** |

### AI Infrastructure

| Project | Description |
|---------|-------------|
| [BACH](https://github.com/ellmos-ai/bach) | Text-based OS for LLMs: handlers, tools, and skills |
| [clutch](https://github.com/ellmos-ai/clutch) | Provider-neutral LLM orchestration with auto-routing and budget tracking |
| [rinnsal](https://github.com/ellmos-ai/rinnsal) | Lightweight agent memory, connectors, and automation infrastructure |
| [ellmos-stack](https://github.com/ellmos-ai/ellmos-stack) | Self-hosted AI research stack |

## License

[MIT](LICENSE) - Lukas Geiger ([ellmos-ai](https://github.com/ellmos-ai))
