import { existsSync } from "node:fs";
import process from "node:process";

export interface SupervisedStdioLaunch {
  command: string;
  args: string[];
  env: Record<string, string> | undefined;
  supervised: boolean;
}

/**
 * Put local stdio backends behind the configured Windows Job-Object supervisor.
 *
 * The MCP SDK only signals the process it spawned. The supervisor owns the
 * backend Job Object, so normal transport close and an unexpected ControlCenter
 * exit both have a bounded cleanup path. Without configuration we retain the
 * SDK transport as the portable fallback for non-Windows/legacy installations.
 */
export function prepareSupervisedStdioLaunch(
  command: string,
  args: string[],
  env?: Record<string, string>
): SupervisedStdioLaunch {
  if (process.platform !== "win32") {
    return { command, args, env, supervised: false };
  }

  const supervisor = process.env.ELLMOS_PROCESS_SUPERVISOR?.trim();
  if (!supervisor) {
    return { command, args, env, supervised: false };
  }
  if (!existsSync(supervisor)) {
    throw new Error(`ELLMOS_PROCESS_SUPERVISOR verweist auf keine vorhandene Datei: ${supervisor}`);
  }

  const python = process.env.ELLMOS_PROCESS_SUPERVISOR_PYTHON?.trim() || "python";
  return {
    command: python,
    args: [supervisor, "supervise", "--", command, ...args],
    env: {
      ...(env ?? {}),
      ELLMOS_SUPERVISOR_PARENT_PID: String(process.pid)
    },
    supervised: true
  };
}
