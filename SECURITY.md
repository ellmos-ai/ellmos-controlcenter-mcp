# Security

## Alpha Status

`ellmos-controlcenter-mcp` is currently an alpha release. It can inspect profiles, prepare generated MCP configs, show local MCP servers, and audit first policy hints. It is not yet a security boundary.

## Current Safety Model

- Dashboard write actions require explicit confirmation.
- Existing profile files and generated MCP config files are backed up before overwrite.
- Environment values are not printed by the profile audit.
- The dashboard binds to `127.0.0.1` by default.

## Not Yet Implemented

- Tool-level policy enforcement
- MCP gateway/proxy enforcement
- User authentication for the dashboard
- Remote multi-user access control
- Tamper-proof audit logs

## Recommendations

- Run the dashboard only on trusted local machines.
- Keep Claude profiles small and task-specific.
- Do not expose the dashboard host publicly.
- Treat `npx`-based MCP servers as less reproducible than pinned local paths.
- Review generated MCP configs before launching a client with them.

## Reporting

For private preview issues, use the private GitHub repository:

https://github.com/ellmos-ai/ellmos-controlcenter-mcp/issues
