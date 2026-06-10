# State

## Current State

- Repository created
- TypeScript MCP scaffold in place
- Initial discovery and profile tools implemented
- Tests for core logic available
- Version `0.1.0-alpha.6` prepared for GitHub/npm release

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

## What Is Still Missing

- Remote auth and header handling for legacy SSE
- Automatic detection of skills, modules, APIs, local programs, executables, CLI apps, and system resources
- Thematic clusters that can be automatically suggested and manually maintained
- Virtual MCP servers built from curated clusters
