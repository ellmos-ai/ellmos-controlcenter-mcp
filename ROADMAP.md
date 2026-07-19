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

Status: planned

- Claude loads only the virtual `ellmos-controlcenter-gateway`
- Gateway starts selected backend servers
- Gateway exposes only allowed tools
- Tool calls are checked, logged, and forwarded
- Capability execution is adapter-gated: ControlCenter plans calls, checks
  policy, and executes only declared MCP, module, folder, or stack adapters

## Phase 5: Publication

Status: planned

- Continuously review translation quality and terminology
- Stable catalog standard
- Security documentation
- Packaging for npm and GitHub
