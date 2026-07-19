# Stack Capability Plan

Status: planned  
Date: 2026-07-05

## Purpose

ControlCenter must stay user-agnostic. It should not hard-code or create a
private `_control-center` folder for every user. Instead, it should discover,
describe, and optionally operate registered stacks through neutral manifests and
adapter contracts.

Stacks are compositions of existing capabilities: MCP servers, skills, modules,
software, local services, folders, prompts, and policies. ControlCenter is the
control plane for discovery, routing, profile selection, policy checks, and
context packing. It is not the owner of every stack component.

## Existing stack signals

- `.STACKS/ellmos-stack/` is the current all-in-one local AI research stack:
  Ollama, n8n, Rinnsal, KnowledgeDigest, and service scripts.
- `.STACKS/ellmos-stack/README.md` references a stack family and a canonical
  future `ellmos-ai/stacks` catalog with a shared manifest schema.
- `agent-ops-stack` is documented as the multi-agent operations stack concept:
  `ticket-master`, `lock-master`, `build-your-users-mind`, skills,
  `controlcenter-mcp`, and `homebase-mcp`.
- The local `_control-center` folder is a private productive stack instance. It
  should be usable by ControlCenter when registered, but it must not become a
  built-in default.
- Several modules already expose machine-readable or semi-structured metadata:
  `ellmos-module.json`, `llms.txt`, `WIRING.md`, `README.md`, `SKILL.md`,
  `server.json`, and MCP `list_tools`.

## Stack manifest direction

ControlCenter should support a neutral stack manifest such as
`ellmos-stack.json`, `controlcenter.stack.json`, or a section in an existing
stack catalog. A manifest describes what exists and how it may be used; it does
not force ControlCenter to own the stack lifecycle.

Minimal fields:

```json
{
  "schema": "ellmos.controlcenter.stack.v1",
  "id": "agent-ops-stack",
  "name": "Agent Operations Stack",
  "visibility": "public-template",
  "components": [
    {
      "id": "ticket-master",
      "type": "module",
      "path": ".MODULES/.CONTROL/ticket-master",
      "roles": ["ticket-system", "router"],
      "adapter": "ticket-master"
    },
    {
      "id": "homebase",
      "type": "mcp",
      "server": "ellmos-homebase-mcp",
      "roles": ["memory", "state", "tasks"]
    }
  ]
}
```

Important distinction:

- Public stack template: portable composition and install rules.
- Local stack instance: user paths, private config, secrets, live ticket/task
  state, and local service status.
- ControlCenter core: discovery, routing, policies, dashboard, and context
  packs.

## Recognition tools

Planned MCP-side tools:

- `controlcenter_list_stacks`
  Lists detected stack manifests and inferred stack candidates.
- `controlcenter_describe_stack`
  Returns a compact stack card: purpose, components, status, entry points,
  privacy class, and missing adapters.
- `controlcenter_find_capability`
  Matches a free-text intent against tools, skills, modules, software, and
  stacks. Returns ranked capability cards instead of full documentation.
- `controlcenter_context_pack`
  Builds a small task-specific context pack with only the relevant manifest
  fields, file references, tool names, and safety notes.

Recognition must prefer deterministic sources before heuristics:

1. Explicit manifests: `controlcenter.stack.json`, `ellmos-stack.json`,
   `ellmos-module.json`, `server.json`.
2. Machine-readable context: `llms.txt`, MCP `list_tools`, package metadata.
3. Wiring and docs: `WIRING.md`, `SKILL.md`, `README.md`.
4. Heuristics over folder names, tags, and descriptions.

## Execution model

ControlCenter should not execute arbitrary module commands just because a README
contains a command. Execution needs a declared adapter and a policy gate.

Execution layers:

1. Discover capability.
2. Resolve adapter and required profile or backend MCP server.
3. Produce a dry-run plan.
4. Check policy: read-only, write, destructive, network, secrets, private data.
5. Execute only through an adapter or MCP tool.
6. Log the operation and return a compact result.

Planned MCP-side tools:

- `controlcenter_plan_capability`
  Returns the proposed adapter, inputs, required profile, risk class, and
  expected side effects.
- `controlcenter_execute_capability`
  Executes only allowed adapter calls. Default should be dry-run unless the
  adapter is explicitly marked safe or the caller opts into execution.

Adapter examples:

- MCP adapter: call an existing MCP tool such as Homebase task tools or
  FileCommander operations.
- Module adapter: call a stable CLI or library entry point declared by the
  module manifest.
- Stack adapter: call install/status/start/stop commands declared by a stack
  manifest.
- Folder adapter: read status files, manifests, and queues from a local stack
  instance. Writes require explicit policy support.

## Boundaries

- ControlCenter may create generated catalog/cache files for its own operation.
- ControlCenter must not create a user's `_control-center` folder by default.
- A stack installer may create such a folder if that stack explicitly owns it.
- Private stacks can be registered locally through configuration, but public
  ControlCenter behavior must remain portable and path-neutral.
- Homebase, ticket-master, lock-master, Rinnsal, and `_control-center` remain
  independent components. ControlCenter can route to them and show them in the
  dashboard; it should not absorb their domain logic.

## Dashboard impact

The dashboard should gain a stack/capability view:

- Stack cards: template vs local instance, status, components, missing adapters.
- Capability cards: matching reason, source type, privacy class, risk class.
- Context pack preview: what would be sent to the LLM.
- Execution preview: dry-run plan, required MCP profile, and policy gates.

## Implementation phases

### P1: Read-only recognition

- Scan stack manifests and infer stack candidates from `.STACKS/ellmos-stack`,
  `llms.txt`, `ellmos-module.json`, and existing MCP server metadata.
- Add stack cards to the build catalog output.
- Add `controlcenter_list_stacks` and `controlcenter_describe_stack`.

### P2: Capability matching and context packs

- Generalize skill-finder logic into `controlcenter_find_capability`.
- Return ranked cards for tools, skills, modules, software, and stacks.
- Add `controlcenter_context_pack` with short, execution, and full levels.

### P3: Adapter-gated execution

- Define adapter schema and policy classes.
- Add dry-run plans for module, MCP, and stack adapters.
- Add `controlcenter_plan_capability`.
- Add `controlcenter_execute_capability` only after policy enforcement and
  audit logging are available.

### P4: Virtual gateway integration

- Expose selected capability groups as virtual MCP servers.
- Keep backend tools hidden unless selected by profile, bundle, or stack.
- Route calls through policy, adapter, and audit layers.
