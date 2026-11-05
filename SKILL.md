---
name: ellmos-controlcenter-mcp
version: "0.7.4"
type: mcp-control-plane
standalone: true
visibility: public
provenance: "ellmos-ai MCP suite"
description: "MCP control plane: local server, tool and skill discovery, capability bundles, dashboard, policy audits, MCP profile resolution, and policy-gated gateway invocation."
---

# ellmos-controlcenter-mcp Skill

Use this skill when interacting with the `ellmos-controlcenter-mcp` Model Context Protocol (MCP) server or integrating local-first MCP stack discovery, profile management, capability bundle composition, and on-demand tool routing into agentic workflows.

## Capabilities & Tool Overview

The server provides 34 registered tools structured into operational domains:

### 1. Localization & Server State
- `controlcenter_get_language`: Returns the active output language (`de`, `en`, `es`, `zh`, `ja`, `ru`).
- `controlcenter_set_language`: Dynamically updates the runtime output language.
- `controlcenter_status`: Reports status of stacks, profiles, detected servers, and runtime health.
- `controlcenter_actual_self_receipt`: Emits a short-lived signed native runtime receipt when host-local configuration is present.

### 2. Local MCP Server & Stack Discovery
- `controlcenter_list_local_servers`: Scans local MCP repositories below configured roots, enriched by `mcps.catalog.v1.json`.
- `controlcenter_describe_mcp`: Details a specific MCP server (kind, namespace, npm name, state ownership, composition).
- `controlcenter_list_stacks`: Enumerates registered stacks from `stacks.catalog.json` with `ellmos.stack.v2` validation.
- `controlcenter_describe_stack`: Examines components, roles, policies, and configuration warnings of a registered stack.
- `controlcenter_context_pack`: Compiles a bounded, manifest-only context handoff for stack tasks without starting processes or reading secrets.

### 3. Capability Catalog, Bundle Assignment & Tool Probing
- `controlcenter_list_tools`: Safely starts local or profile-defined MCP servers to retrieve real tool definitions under bounded concurrency and response caps.
- `controlcenter_find_capability`: Ranks stable, type-consistent native-binding claims from System Explorer resolution.
- `controlcenter_tool_overview`: Lists tool claims preserving declared, installed, configured, running, healthy, and observed axes.
- `controlcenter_assign_tool_bundles`: Assigns discovered MCP tools to capability bundles.
- `controlcenter_list_bundles`: Enumerates capability bundles and member tools.
- `controlcenter_suggest_bundles`: Recommends capability bundles tailored to specific task requirements.
- `controlcenter_build_catalog`: Constructs an aggregated local catalog manifest.

### 4. Profile Management & Policy Audits
- `controlcenter_list_profiles`: Discovers and enumerates configured MCP profiles.
- `controlcenter_suggest_profile`: Analyzes task intent and suggests the optimal profile.
- `controlcenter_resolve_profile`: Computes inheritance and resolves flattened profile configurations.
- `controlcenter_switch_profile`: Prepares declarative profile switches for MCP clients.
- `controlcenter_audit_profile`: Executes security and hygiene policy checks against profile declarations.

### 5. Skills, Semantic Routing & Plugins
- `controlcenter_list_skills`: Indexes available agent skills across local libraries.
- `controlcenter_find_skill`: Performs keyword and intent matching against the skill catalog.
- `controlcenter_resolve_semantic_route`: Resolves natural language prompts to optimal skill and tool routes.
- `controlcenter_list_plugins`: Inspects installed plugins and their integration state.

### 6. Host Governance & Canonical Lock Introspection
- `controlcenter_list_locks`: Lists active canonical file/project locks (`LOCK*.txt`, `LOCK.user.*`, `LOCK.until.*`, `LOCK.condition.*`).
- `controlcenter_check_lock`: Checks if a specific path or repository is locked before file or git mutations.
- `controlcenter_evaluate_permission`: Evaluates hierarchical permissions from `LOCK.permissions.json` up directory trees.
- `controlcenter_list_decisions`: Reads pending user and architectural decision items.
- `controlcenter_list_governance`: Mirrors host policy registries and governance manifests.
- `controlcenter_list_resources`: Enumerates known systems and software assets from the read-only inventory mirror.
- `controlcenter_describe_resource`: Inspects detailed metadata of a specific inventory asset.

### 7. Policy-Gated Gateway & On-Demand Dispatch
- `controlcenter_list_available_tools`: Lists tools from unloaded backend MCP servers without keeping processes resident.
- `controlcenter_invoke`: Executes a single tool on an unloaded backend server, gated by `data/gateway-policy.json` with recursive secret redaction and audit logging.

## Governance & Runtime Invariants

Every operation adheres strictly to the following 10 invariants:
- **`INV-LOCAL-01` (Local-First Administration & Explicit Egress)**: Dashboard loopback binding (`127.0.0.1`), zero background telemetry. Remote calls require explicit HTTPS configuration.
- **`INV-GATE-02` (Fail-Closed Gateway Policy Guard)**: Gateway invocations require explicit policy match; missing or malformed policies deny all calls.
- **`INV-SUB-03` (Ephemeral Child Process Boundaries)**: Connect-per-call stdio lifecycle; child processes terminate immediately upon completion.
- **`INV-SCRUB-04` (Recursive Secret Redaction & Finite Budgets)**: Pattern-based secret scrubbing across payloads; 256 KiB request and 1 MiB response limits.
- **`INV-PRIV-05` (Non-Elevation User Mode / RunAsInvoker)**: Pure standard user mode; never requests or requires administrative privileges.
- **`INV-LOCK-06` (Canonical Multi-Agent Lock Awareness)**: Respects multi-agent locks fail-closed (read-only enforcement).
- **`INV-PERM-07` (Nearest Permission Register Introspection)**: Evaluates hierarchical permission declarations up directory trees.
- **`INV-GOV-08` (Read-Only Host Governance Federation)**: Transparently mirrors host decisions and policies without mutating authority.
- **`INV-SYNC-09` (Cloud-Sync Conflict Hardening)**: Protects against multi-host conflict files and lock artifacts.
- **`INV-SLA-10` (Bilingual Security SLA)**: Binding 48-hour response confirmation and 30-day remediation SLA.

## Configuration & Usage

Add the server to your client configuration (`mcp_config.json`):

```json
{
  "mcpServers": {
    "ellmos-controlcenter-mcp": {
      "command": "npx",
      "args": ["-y", "ellmos-controlcenter-mcp"]
    }
  }
}
```

Or configure via a local clone:

```json
{
  "mcpServers": {
    "ellmos-controlcenter-mcp": {
      "command": "node",
      "args": ["dist/index.js"]
    }
  }
}
```
