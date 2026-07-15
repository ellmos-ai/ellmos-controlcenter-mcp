import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";

export const DEFAULT_STACKS_ROOT =
  process.env.ELLMOS_STACKS_ROOT ?? getDefaultStacksRoot();

export function getDefaultStacksRoot(
  env: NodeJS.ProcessEnv = process.env,
  homeDirectory: string = os.homedir()
): string {
  const oneDriveRoot = firstNonEmptyPath(env.OneDrive, env.ONEDRIVE) ?? path.join(homeDirectory, "OneDrive");
  return path.join(oneDriveRoot, ".TOPICS", ".AI", ".STACKS");
}

function firstNonEmptyPath(...values: Array<string | undefined>): string | null {
  for (const value of values) {
    if (value && value.trim().length > 0) return value;
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

async function readJson(filePath: string): Promise<unknown | null> {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf-8"));
  } catch {
    return null;
  }
}

function resolveInsideRoot(root: string, relativePath: string): string | null {
  const resolvedRoot = path.resolve(root);
  const resolvedPath = path.resolve(resolvedRoot, relativePath);
  const relative = path.relative(resolvedRoot, resolvedPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative)) ? resolvedPath : null;
}

export interface StackSummary {
  id: string;
  name: string;
  kind: string | null;
  status: string | null;
  visibility: string | null;
  absolutePath: string;
  manifestPath: string;
  manifestSchema: string | null;
  repository: string | null;
  roles: string[];
  componentCount: number;
  mcpServerCount: number;
  skillCount: number;
  nestedStackCount: number;
  externalComponentCount: number;
  warnings: string[];
}

export interface StackDetails extends StackSummary {
  components: string[];
  mcpServers: string[];
  skills: string[];
  nestedStacks: string[];
  externalComponents: string[];
  requiredRoles: string[];
  policies: Record<string, unknown>;
}

export async function scanStacks(stacksRoot: string = DEFAULT_STACKS_ROOT): Promise<StackSummary[]> {
  const catalog = await readJson(path.join(stacksRoot, "stacks.catalog.json"));
  if (!isRecord(catalog) || catalog.schema !== "ellmos.stacks.catalog.v1" || !Array.isArray(catalog.stacks)) {
    return [];
  }

  const results = await Promise.all(catalog.stacks.map((entry) => readStackEntry(entry, stacksRoot)));
  return results.filter((entry): entry is StackSummary => entry !== null);
}

export async function describeStack(stackId: string, stacksRoot: string = DEFAULT_STACKS_ROOT): Promise<StackDetails | null> {
  const catalog = await readJson(path.join(stacksRoot, "stacks.catalog.json"));
  if (!isRecord(catalog) || catalog.schema !== "ellmos.stacks.catalog.v1" || !Array.isArray(catalog.stacks)) {
    return null;
  }
  const entry = catalog.stacks.find((candidate) => isRecord(candidate) && candidate.id === stackId);
  if (!entry) return null;
  return readStackEntry(entry, stacksRoot, true) as Promise<StackDetails | null>;
}

async function readStackEntry(
  value: unknown,
  stacksRoot: string,
  includeDetails = false
): Promise<StackSummary | StackDetails | null> {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.path !== "string" || typeof value.manifest !== "string") {
    return null;
  }

  const absolutePath = resolveInsideRoot(stacksRoot, value.path);
  const manifestPath = resolveInsideRoot(stacksRoot, value.manifest);
  if (!absolutePath || !manifestPath) return null;

  const manifestValue = await readJson(manifestPath);
  const manifest = isRecord(manifestValue) ? manifestValue : {};
  const warnings: string[] = [];
  if (manifest.schema !== "ellmos.stack.v2") warnings.push("manifest_schema_invalid");
  if (typeof manifest.id === "string" && manifest.id !== value.id) warnings.push("manifest_id_mismatch");
  if (!isRecord(manifestValue)) warnings.push("manifest_unreadable");

  const components = Array.isArray(manifest.components) ? manifest.components : [];
  const componentIds = components.flatMap((component) =>
    isRecord(component) && typeof component.id === "string" ? [component.id] : []
  );
  const externalComponents = Array.isArray(manifest.external_components) ? manifest.external_components : [];
  const externalIds = externalComponents.flatMap((component) =>
    isRecord(component) && typeof component.id === "string" ? [component.id] : []
  );

  const summary: StackSummary = {
    id: value.id,
    name: typeof value.name === "string" ? value.name : value.id,
    kind: typeof value.kind === "string" ? value.kind : null,
    status: typeof value.status === "string" ? value.status : typeof manifest.status === "string" ? manifest.status : null,
    visibility: typeof value.visibility === "string" ? value.visibility : typeof manifest.visibility === "string" ? manifest.visibility : null,
    absolutePath,
    manifestPath,
    manifestSchema: typeof manifest.schema === "string" ? manifest.schema : null,
    repository: typeof value.repository === "string" ? value.repository : null,
    roles: stringArray(value.roles),
    componentCount: componentIds.length,
    mcpServerCount: stringArray(manifest.mcp_servers).length,
    skillCount: stringArray(manifest.skills).length,
    nestedStackCount: stringArray(manifest.nested_stacks).length,
    externalComponentCount: externalIds.length,
    warnings
  };

  if (!includeDetails) return summary;
  return {
    ...summary,
    components: componentIds,
    mcpServers: stringArray(manifest.mcp_servers),
    skills: stringArray(manifest.skills),
    nestedStacks: stringArray(manifest.nested_stacks),
    externalComponents: externalIds,
    requiredRoles: stringArray(manifest.required_roles),
    policies: isRecord(manifest.policies) ? manifest.policies : {}
  };
}
