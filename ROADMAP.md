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
- Detect system resources: paths, installed software, executables, CLI apps, and software with CLI interfaces
- Capture usage possibilities for detected software: supported file types, typical commands, local APIs, and automation paths
- Detect APIs in use from code, configurations, profiles, and tool schemas
- Reference or maintain current documentation for detected APIs, preferably via Context7 or comparable sources
- Evaluate the BACH partner program and BACH-internal tool/skill structures as an input source

## Phase 3: Permissions and Policies

Status: planned

- `policy.json` for profiles, servers, and tools
- Permissions: `allow`, `deny`, `ask`, `readonly`
- Mask secret values
- Audit log for profile and permission changes

## Phase 3.5: Thematic Clusters and Virtual Servers

Status: planned

- Automatically cluster detected tools, MCPs, skills, modules, APIs, programs, executables, and CLIs by topic
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

## Phase 5: Publication

Status: planned

- Continuously review translation quality and terminology
- Stable catalog standard
- Security documentation
- Packaging for npm and GitHub
