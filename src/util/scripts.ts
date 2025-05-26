import { NS, RunOptions, ScriptArg } from "@ns";
import { getFreeRAM, getAccess, validateHostname } from "./servers";
import { getSubservers } from "./subservers";

export interface ScriptTemplate {
  filename: string,
  threads?: number,
  args?: any[],
  duration?: number,
}

export interface Script extends ScriptTemplate {
  filename: string,
  status?: {
    pid: number,
    hostname?: string,
    starttime?: number,
  },
}

export function haveScriptsSameArgs(script1: ScriptTemplate, script2: ScriptTemplate): boolean {
  const sameFile = script1.filename == script2.filename;
  const sameArgs = areArraysIdentical(script1.args ?? [], script2.args ?? [])
  return sameFile && sameArgs;
}

export function getRamCost(ns: NS, ...scripts: ScriptTemplate[]): number {
  let sum = 0;

  scripts.forEach(script => {
    const threads = script.threads ?? 1;
    sum += threads * ns.getScriptRam(script.filename)
  })

  return sum;
}

export function runScriptOnServer(ns: NS, hostname: string, script: ScriptTemplate): Script {
  validateFilename(ns, script.filename);
  validateHostname(ns, hostname);

  const threads = script.threads ?? 1;
  const args = script.args ?? [];

  ns.scp(script.filename, hostname, "home");
  const pid = ns.exec(script.filename, hostname, threads, ...args)

  if (pid === 0) {
    ns.print("Failed to start script:\n", script)
    throw new Error(`Failed to start script ${script.filename} on ${hostname}\n`);
  }

  const s: Script = {
    ...script,
    status: {
      pid: pid,
      starttime: Date.now(),
      hostname: hostname,
    }
  }

  return s;
}

type RunRes = {
  hasRun: boolean,
  pid: number,
  hostname: string,
}

export function runOnFree(ns: NS, scriptName: string, servers: string[] | null = null, threadOrOptions?: number | RunOptions, ...args: ScriptArg[]): RunRes {
  if (!ns.fileExists(scriptName, "home")) {
    ns.ui.openTail();
    ns.printf("%s is not a valid filename", scriptName);
    ns.exit()
  }

  const ram = ns.getScriptRam(scriptName);

  const server_arr = servers || Array.from(getSubservers(ns, "home"));
  const potentialServers = server_arr.map(server => ns.getServer(server));
  const freeServers = potentialServers
    .filter(server => getAccess(ns, server.hostname))
    .filter(server => (server.maxRam - server.ramUsed) > ram)

  if (freeServers.length <= 0) return {
    hasRun: false,
    pid: 0,
    hostname: "",
  };

  const executer = freeServers[0];
  ns.scp(scriptName, executer.hostname, "home");
  const pid = ns.exec(scriptName, executer.hostname, threadOrOptions, ...args)

  return {
    hasRun: pid != 0,
    pid: pid,
    hostname: executer.hostname,
  }
}

function areArraysIdentical(arr1: any[], arr2: any[]) {
  if (arr1.length !== arr2.length) {
    return false;
  }
  for (let i = 0; i < arr1.length; i++) {
    if (arr1[i] !== arr2[i]) {
      return false;
    }
  }
  return true;
}

export function findRunningScript(ns: NS, scriptName: string, ...args: ScriptArg[]): Script[] {
  const servers = Array.from(getSubservers(ns, "home")).map(server => ns.getServer(server));
  const scriptList: Script[] = [];

  servers.forEach(server => {
    const scripts = ns.ps(server.hostname);
    scripts.forEach(script => {
      if (script.filename != scriptName) return;
      if (!areArraysIdentical(script.args, args)) return;

      const s: Script = {
        filename: script.filename,
        args: script.args ?? [],
        threads: script.threads ?? 1,
        status: {
          pid: script.pid,
          hostname: server.hostname,
        }
      }
      scriptList.push(s);
    })
  })

  return scriptList;
}

// ==================================================

const running = new Map();

// ==================================================

export function validateFilename(ns: NS, scriptName: string) {
  if (!ns.fileExists(scriptName)) {
    ns.ui.openTail();
    ns.printf("%s is not a valid script name!", scriptName)
    ns.exit()
  }
}

export function findExecutor(ns: NS, script: Script): string | undefined {
  validateFilename(ns, script.filename)

  const threads = script.threads || 1;
  const ram_cost = ns.getScriptRam(script.filename) * threads;

  const validServers = getSubservers(ns, "home")
    .filter(server => server != "home")
    .filter(server => getFreeRAM(ns, server) > ram_cost);

  return validServers[0];
}
