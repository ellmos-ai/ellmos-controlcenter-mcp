# Security

## Alpha Status

`ellmos-controlcenter-mcp` is currently an alpha release. It can inspect profiles, prepare generated MCP configs, show local MCP servers, and audit first policy hints. It is not yet a security boundary.

## Current Safety Model

- Dashboard write actions require explicit confirmation.
- Existing profile files and generated MCP config files are backed up before overwrite.
- Environment values are not printed by the profile audit.
- The dashboard binds to `127.0.0.1` by default.
- `controlcenter_context_pack` reads only the server-configured registered stack root. It excludes absolute paths, arbitrary project files, commands, secrets, live state, and unallowlisted policy values.
- `controlcenter_actual_self_receipt` is disabled unless an explicit host-local configuration is present. It pins an Ed25519 key file by SHA-256, probes only this package's `list_tools` surface, redacts error details at the MCP boundary, and does not provision trust or authorize execution.
- `controlcenter_invoke` enforces the Eigendark hardening invariants: policy-gated dispatch (`data/gateway-policy.json`), connect-per-call isolation (no persistent child processes), recursive credential redaction on forwarded results, strict finite resource budgets (request bytes, response bytes, nesting depth, block counts, and concurrent execution slots), transport policy (HTTPS-only for remote targets, loopback plain HTTP, redirect refusal), and structured JSONL audit logging (`gateway-audit.jsonl`) recording argument names and counts but never argument values.

## Not Yet Implemented

- User authentication for the dashboard
- Remote multi-user access control
- Tamper-proof audit logs
- Runtime enforcement of declared stack policies

## Recommendations

- Run the dashboard only on trusted local machines.
- Keep Claude profiles small and task-specific.
- Do not expose the dashboard host publicly.
- Treat `npx`-based MCP servers as less reproducible than pinned local paths.
- Review generated MCP configs before launching a client with them.
- Keep the actual-self producer configuration and private key host-local, restrict their file permissions, and rotate the key if its path or contents may have been exposed.

## Reporting

For private preview issues, use the private GitHub repository:

https://github.com/ellmos-ai/ellmos-controlcenter-mcp/issues
