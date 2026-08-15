# Roadmap

## Vision

`ellmos-controlcenter-mcp` is intended to become the local control plane for MCP servers and the entire local agent-tooling ecosystem. Long-term it will manage profiles, servers, tools, skills, modules, APIs, local programs, executables, CLI apps, permissions, audits, and virtual gateway MCPs through which selected capabilities are exposed as controlled servers.

## Phase 1: ControlCenter Dashboard

Status: started

- Display local MCP servers
- Display Claude profiles
- Enable and disable servers per profile
- Surface audit hints
- Write generated `--mcp-config` files

### Claude Code restart / reconnect hint workflow

Current behavior stays deliberately non-invasive: `controlcenter_switch_profile` prepares a resolved `--mcp-config` file and a launch command, but it does not mutate a running Claude Code session.

Planned optional workflow:

- After a profile change is written, return a structured restart hint alongside the existing launch command. The hint should explain that the running session still uses the old MCP configuration until the client reconnects or restarts with the generated config.
- In the dashboard, show the same hint as a confirmation step with a copyable command. The dashboard should not kill or restart Claude Code by itself.
- Keep automatic reconnection behind an explicit adapter contract. A future adapter may expose `hint`, `openCommand`, or `reconnect` modes, but `reconnect` must be opt-in, client-specific, and fail closed when ControlCenter cannot prove that the target client supports it safely.
- Keep generated MCP configs provider-neutral. Claude Code remains the default launch template, while Codex, Gemini, Cursor, or other clients can still override the command via `launchTemplate` / `ELLMOS_LAUNCH_TEMPLATE`.
- Test coverage should verify that write-mode profile switching surfaces the hint, preview mode stays read-only, custom launch templates are preserved, and no process-control action runs without an explicit reconnect adapter.

## Phase 2: Tool Catalog

Status: started

- [x] Start local backend MCP servers in a controlled way
- [x] Read `list_tools` output per local stdio server
- [x] Store tool names, descriptions, and schemas in probe results
- [x] Support profile servers, remote servers, and alternative launch forms
- [x] Assign tools to capability bundles
- [x] Add dashboard visualization for tool catalog and tool-bundle assignments
- [x] Implement i18n base for MCP outputs and dashboard with German/English
- [x] Add text sets for `es`, `zh`, `ja`, and `ru`
- Remote authentication and header edge cases

## Phase 2.5: Resource, Skill, and API Inventory

Status: planned

- Automatic scans for skills, modules, MCP servers, tool definitions, and local configuration sources
- Detect stack manifests and stack candidates from sources such as `ellmos-stack`, future stack catalogs, `ellmos-module.json`, `llms.txt`, `WIRING.md`, `server.json`, and registered local stack roots
- Detect system resources: paths, installed software, executables, CLI apps, and software with CLI interfaces
- Capture usage possibilities for detected software: supported file types, typical commands, local APIs, and automation paths
- Detect APIs in use from code, configurations, profiles, and tool schemas
- Reference or maintain current documentation for detected APIs, preferably via Context7 or comparable sources
- Evaluate the BACH partner program and BACH-internal tool/skill structures as an input source

### Stack and capability recognition (2026-07-05)

ControlCenter must remain user-agnostic. It should not hard-code a private
`_control-center` folder or create one for every user. Instead, it should
discover public stack templates and local stack instances through neutral
manifests and adapter contracts.

- **Stack detection** — add read-only stack inventory tools such as
  `controlcenter_list_stacks` and `controlcenter_describe_stack`.
- **Capability finder** — generalize skill recognition into
  `controlcenter_find_capability`, matching intents against tools, skills,
  modules, software, APIs, and stacks while returning compact cards instead of
  full documentation.
- **Context packs** — add `controlcenter_context_pack` so agents receive only
  the relevant manifest fields, file references, tool names, and safety notes.
- **Private stack support** — allow local users to register private stack roots
  such as `_control-center`, while keeping the public ControlCenter core
  portable and path-neutral.

See `STACK-CAPABILITY-PLAN.md` for the detailed recognition and execution plan.

### Skill recognition / skill-finder (2026-06-27)

The skill scan (`controlcenter_list_skills`) already enumerates skills. The missing piece is
*recognition*: given a free-text task or intent, return the ranked skills that apply.

- **`find_skill` / `suggest_skill` tool** — match an intent against the scanned skill catalog and
  return ranked candidates with the trigger reason (which phrase matched). `SKILL.md` `description`
  fields are authored as trigger phrases ("Aktiviert sich bei …") plus `tags` and `aliases`, so
  keyword/intent matching over description+tags+aliases is the primary signal. Mirror the existing
  `suggest_bundles` / `suggest_profile` pattern. **Decision (2026-06-27): lexical matching at the
  core** (keyword/alias over description+tags+aliases — zero-dependency, deterministic); **optional
  embedding/semantic ranking is a stretch goal behind explicit configuration** (requires a local
  embedding model), consistent with the credential-/dependency-free design of the ellmos servers.
- **Cross-agent availability** — reuse the `agent-config-sync` registry/cache (which agent app
  exposes which skill, and where) so the finder reports availability per agent, not only on disk.
  `agent-config-sync` already treats ControlCenter as its profile backend.
- **Shared taxonomy with `skill-explorer`** — align the MCP-side recognition with the skill-side
  `skill-explorer` (audit/cluster/finder authoring) so both use one cluster/family taxonomy; this
  also feeds the Phase 3.5 thematic-cluster work.

## Phase 3: Permissions and Policies

Status: planned

- `policy.json` for profiles, servers, and tools
- Permissions: `allow`, `deny`, `ask`, `readonly`
- Mask secret values
- Audit log for profile and permission changes

## Phase 3.5: Thematic Clusters and Virtual Servers

Status: planned

- Automatically cluster detected tools, MCPs, skills, modules, APIs, programs, executables, and CLIs by topic
- Maintain planned personal-domain bundles for dashboard display and future MCP packlists:
  `personal-office`, `personal-privacy`, `personal-tax-finance`, `personal-health`,
  `personal-notes-knowledge`, and `personal-data-readers`
- Enable and disable global clusters
- Create manual clusters
- Modify, rename, merge, or split automatically created clusters
- Assign stable names with descriptions, tags, and usage examples to clusters
- Connect clusters to virtual MCP servers so that agents can load curated capability servers instead of many individual sources
- Use clusters as the basis for profiles, gateway rules, documentation context, and dashboard views

## Phase 4: Virtual MCP Gateway

Status: partially implemented (2026-08-16)

The deferral recorded on 2026-07-23 was lifted by the user on 2026-08-16. What
shipped is the MCP forwarding path; the adapter classes beyond MCP are still open.

- [x] Gateway starts selected backend servers on demand
- [x] Tool calls are checked against a policy, logged to an audit trail, and forwarded
- [x] `controlcenter_list_available_tools` reports what is reachable without loading it
- [x] `controlcenter_invoke` runs one tool of a server the host has not loaded
- Capability execution is adapter-gated: ControlCenter plans calls, checks
  policy, and executes only declared MCP, module, folder, or stack adapters —
  **only the MCP adapter exists**; module, folder, and stack adapters remain open

### Divergence from the original sketch

This section originally read "Claude loads only the virtual
`ellmos-controlcenter-gateway`", i.e. a *separate* server process. The
implementation instead adds two tools to the existing ControlCenter server.

The goal is a small default profile — FileCommander, ControlCenter,
open-compute — in which ControlCenter is loaded anyway. A separate gateway
process would add another profile entry and another child process, which works
against that goal. The separate-process form remains a possible later variant;
the divergence is deliberate and recorded in `DECISIONS.md`.

### Known gaps

- No connection pooling: each invocation connects and disconnects. This is a
  deliberate trade against leaving stdio child processes behind, at the cost of
  roughly 200–500 ms per call on a cold server.
- No streaming, progress notifications, sampling, or elicitation pass-through;
  a forwarded call returns one final result.
- Backend resources and prompts are not exposed — tools only.
- Remote authentication and header edge cases inherit the limits of the tool
  catalog: profile-declared headers are passed through, and nothing else.

## Phase 5: Publication

Status: planned

- Continuously review translation quality and terminology
- Stable catalog standard
- Security documentation
- Packaging for npm and GitHub
