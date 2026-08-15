# State

## Current State

- Repository created
- TypeScript MCP scaffold in place
- Initial discovery and profile tools implemented
- Tests for core logic available
- Version `0.5.0` prepared for GitHub/npm review; publication is not implied
- ControlCenter is no longer read-only in the request path: the gateway forwards tool calls to
  backend MCP servers under a policy gate and an audit log
- Optional actual-self producer implemented fail-closed; no host trust store or live routing activation is configured by the package

## What the MVP Can Do

- Detect local MCP repositories
- Read metadata from `package.json`
- Derive rough tool counts from descriptions
- Read and summarize Claude profiles
- Recommend a profile based on task keywords
- Write a JSON catalog
- Resolve profiles including `extends` chains
- Prepare generated `--mcp-config` files for profile switching
- Group local servers into capability bundles
- Recommend capability bundles based on a task
- Audit profiles for initial policy hints
- Load, disable, and override the severity of policy rules from `data/policy-rules.json`
- Start local stdio MCP servers and read real tool lists via MCP `list_tools`
- Scan resolved Claude profile servers including arbitrary stdio commands and URL-based Streamable HTTP/SSE configs
- Optionally include tool probe results in the local server catalog
- Assign probed tools to capability bundles based on their metadata
- Start a local browser dashboard
- Enable and disable servers per profile in the dashboard
- Display tool catalog and tool-bundle assignments in the dashboard
- Switch MCP outputs and dashboard between German, English, Spanish, Chinese, Japanese, and Russian
- Secure write actions with confirmation and backup
- Scan local skills from source roots (category subdirectories) and deployed skill directories
- Scan local plugins from a plugin root and report type, marketplace scope, and sub-component presence
- List and filter skills and plugins via `controlcenter_list_tools`
- Match a free-text task or intent against the scanned skill catalogue and return ranked skill candidates with matched terms (`controlcenter_find_skill`)
- Validate caller-selected semantic coordinator/expert/persona routes against a provider-neutral map and verify endpoint availability against the live skill inventory (`controlcenter_resolve_semantic_route`)
- Consume hash-consistent System Explorer resolutions for typed lexical capability claims without owning a second registry or granting execution authority; provenance and identity remain unverified (`controlcenter_find_capability`)
- Show native-bound components while keeping declared and actual runtime-state axes separate (`controlcenter_tool_overview`)
- Build bounded `short`, `execution`, or `full` context packs for registered stacks without loading arbitrary project files, secrets, commands, or live state (`controlcenter_context_pack`)
- List the tools of MCP servers the host has not loaded, marking any server that could not be asked as unreachable with an unknown tool count instead of as a server without tools (`controlcenter_list_available_tools`)
- Invoke a single tool on such a server and return its result, gated by `data/gateway-policy.json` and recorded in an audit log that holds argument names but never argument values (`controlcenter_invoke`)
- Keep the four gateway failure modes apart: unknown server, unreachable server, unknown tool, and a tool error reported by the target — the last one means the call did arrive
- Redact forwarded results recursively before they reach the caller, report how many values changed, and mark every forwarded payload as untrusted data rather than as instructions
- Hold the gateway to finite request, response, nesting, content-block, and concurrency budgets; refuse oversized arguments outright and truncate oversized answers visibly
- Restrict remote gateway targets to HTTPS, allow plain HTTP only on loopback, refuse redirects, and narrow further through an optional host allowlist

## What Is Still Missing

- Automatic semantic role selection or an embedding ranker; ControlCenter validates caller-selected routes but does not infer them or grant execution authority
- A separately trusted System Explorer resolution receipt; current resolution files prove only internal hash consistency
- Host-trusted availability evidence and policy-gated selection/execution remain outside this package
- Remote auth and header handling for legacy SSE
- Thematic clusters that can be automatically suggested and manually maintained
- Virtual MCP servers built from curated clusters; the gateway forwards calls but does not yet
  package a curated group as its own server
- Gateway connection pooling; each invocation connects and disconnects, deliberately, so that no
  stdio child process is left behind
- Gateway pass-through for streaming, progress, sampling, elicitation, resources, and prompts;
  only tool calls with a single final result are forwarded
- Risk-class policies for the gateway (read-only, write, destructive, network, secrets); the gate
  matches server and tool patterns and does not yet act on backend tool annotations
- Opaque session-bound capabilities; the gateway holds no session and issues no capability handle,
  so there is nothing to make opaque yet
- Response and concurrency budgets on the tool-scanning path; only the gateway invoke path enforces
  them, while scanning shares the transport policy but not the limits
- Policy-gated context packs for arbitrary skill, module, or project content
- Optional Claude Code restart/reconnect guidance after written profile changes; the workflow is planned, but no live-session mutation is implemented
