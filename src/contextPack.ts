import * as path from "path";
import { DEFAULT_STACKS_ROOT, describeStack, type StackDetails } from "./stacks.js";

export const CONTEXT_PACK_LEVELS = ["short", "execution", "full"] as const;
export type ContextPackLevel = typeof CONTEXT_PACK_LEVELS[number];

const MAX_ITEMS_PER_GROUP = 40;
const MAX_VALUE_LENGTH = 160;
const SAFE_POLICY_KEYS = new Set([
  "network",
  "local_first",
  "airgap",
  "runtime_enforcement",
  "activation",
  "updates",
  "storage"
]);

function escapeMarkdown(value: string): string {
  return value
    .replace(/[\r\n]+/g, " ")
    .replace(/([\\`*_{}\[\]<>|#])/g, "\\$1")
    .slice(0, MAX_VALUE_LENGTH);
}

function bulletList(items: string[]): string[] {
  const safeItems = [...new Set(items.map(escapeMarkdown))].sort();
  const visibleItems = safeItems.slice(0, MAX_ITEMS_PER_GROUP);
  if (safeItems.length > MAX_ITEMS_PER_GROUP) {
    visibleItems.push(`… ${safeItems.length - MAX_ITEMS_PER_GROUP} additional declared items omitted`);
  }
  return visibleItems.length > 0 ? visibleItems.map((item) => `- ${item}`) : ["-"];
}

function componentGroups(stack: StackDetails): Array<[string, string[]]> {
  return [
    ["Components", stack.components],
    ["MCP servers", stack.mcpServers],
    ["Skills", stack.skills],
    ["Nested stacks", stack.nestedStacks],
    ["External components", stack.externalComponents]
  ];
}

function safePolicyLines(policies: Record<string, unknown>): string[] {
  const lines: string[] = [];
  for (const key of [...SAFE_POLICY_KEYS].sort()) {
    const value = policies[key];
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      lines.push(`- ${key}: ${escapeMarkdown(String(value))}`);
    } else if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
      const values = bulletList(value).map((item) => item.slice(2));
      lines.push(`- ${key}: ${values.join(", ") || "-"}`);
    }
  }
  return lines.length > 0 ? lines : ["-"];
}

/**
 * Builds a compact, manifest-only context handoff for a registered stack.
 * It deliberately does not read arbitrary project files, secrets, commands,
 * or live service state. Manifest declarations are context, not enforcement.
 */
export async function buildStackContextPack(
  stackId: string,
  level: ContextPackLevel = "short",
  stacksRoot: string = DEFAULT_STACKS_ROOT
): Promise<string | null> {
  const stack = await describeStack(stackId, stacksRoot);
  if (!stack) return null;

  const lines = [
    `# Context Pack: ${escapeMarkdown(stack.name)}`,
    "",
    `- ID: ${escapeMarkdown(stack.id)}`,
    `- Kind: ${stack.kind ? escapeMarkdown(stack.kind) : "-"}`,
    `- Status: ${stack.status ? escapeMarkdown(stack.status) : "-"}`,
    `- Visibility: ${stack.visibility ? escapeMarkdown(stack.visibility) : "-"}`,
    `- Validation warnings: ${stack.warnings.length > 0 ? bulletList(stack.warnings).map((item) => item.slice(2)).join(", ") : "-"}`,
    "",
    "## Declared components"
  ];

  for (const [label, values] of componentGroups(stack)) {
    lines.push(`### ${label}`, ...bulletList(values));
  }

  if (level === "execution" || level === "full") {
    lines.push("", "## Execution boundary", "- This is a read-only plan input, not an execution instruction.");
    lines.push("- Resolve an explicit adapter and policy gate before starting a component or performing a write.");
    lines.push("- No profile, service, secret, command, or live state was read for this context pack.");
    lines.push("", "## Required roles", ...bulletList(stack.requiredRoles));
  }

  if (level === "full") {
    const relativeManifest = path.relative(path.resolve(stacksRoot), stack.manifestPath).split(path.sep).join("/");
    lines.push("", "## Manifest reference", `- ${escapeMarkdown(relativeManifest || "stack.v2.json")}`);
    lines.push("", "## Declared policy summary", ...safePolicyLines(stack.policies));
    lines.push("", "## Safety note", "- Policies are declared manifest metadata; they are not proof of runtime enforcement.");
  }

  return lines.join("\n");
}
