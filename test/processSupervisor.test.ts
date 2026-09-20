import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { prepareSupervisedStdioLaunch } from "../src/processSupervisor.js";

const previousSupervisor = process.env.ELLMOS_PROCESS_SUPERVISOR;
const previousPython = process.env.ELLMOS_PROCESS_SUPERVISOR_PYTHON;

afterEach(() => {
  if (previousSupervisor === undefined) delete process.env.ELLMOS_PROCESS_SUPERVISOR;
  else process.env.ELLMOS_PROCESS_SUPERVISOR = previousSupervisor;
  if (previousPython === undefined) delete process.env.ELLMOS_PROCESS_SUPERVISOR_PYTHON;
  else process.env.ELLMOS_PROCESS_SUPERVISOR_PYTHON = previousPython;
});

describe("process supervisor launch", () => {
  it("wraps Windows stdio launches and passes the ControlCenter PID", () => {
    const script = path.join(os.tmpdir(), `controlcenter-supervisor-${process.pid}.py`);
    writeFileSync(script, "# fixture\n", "utf8");
    process.env.ELLMOS_PROCESS_SUPERVISOR = script;
    process.env.ELLMOS_PROCESS_SUPERVISOR_PYTHON = "python-fixture";

    try {
      const launch = prepareSupervisedStdioLaunch("node", ["server.mjs"], { FIXTURE: "yes" });
      if (process.platform !== "win32") {
        expect(launch.supervised).toBe(false);
        return;
      }
      expect(launch.supervised).toBe(true);
      expect(launch.command).toBe("python-fixture");
      expect(launch.args).toEqual([script, "supervise", "--", "node", "server.mjs"]);
      expect(launch.env).toMatchObject({ FIXTURE: "yes", ELLMOS_SUPERVISOR_PARENT_PID: String(process.pid) });
    } finally {
      if (existsSync(script)) unlinkSync(script);
    }
  });

  it("fails closed when the configured supervisor is missing", () => {
    process.env.ELLMOS_PROCESS_SUPERVISOR = path.join(os.tmpdir(), "missing-controlcenter-supervisor.py");
    if (process.platform !== "win32") {
      expect(() => prepareSupervisedStdioLaunch("node", [])).not.toThrow();
      return;
    }
    expect(() => prepareSupervisedStdioLaunch("node", [])).toThrow(/keine vorhandene Datei/);
  });
});
