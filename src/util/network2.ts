import { NS, } from "@ns"
import { getTotalRam, runScriptsUpToCount } from "./network";
import { haveScriptsSameArgs, runScriptOnServer, Script, ScriptTemplate } from "./scripts"
import { validateHostname } from "./servers";
import { getExecutors } from "./subservers";

export interface ServerAllocation {
  hostname: string,
  maxRam: number,
  usedRam: number,
  freeRam: number,

  allocatedRam: number,
}

export const allocatedServers: Map<string, ServerAllocation> = new Map();

export function getAllocationServer(ns: NS, hostname: string): ServerAllocation {
  validateHostname(ns, hostname);

  const server = ns.getServer(hostname);
  const allocator: ServerAllocation = {
    allocatedRam: 0,
    freeRam: 0, //temp
    ...allocatedServers.get(hostname),
    hostname: hostname,
    maxRam: server.maxRam,
    usedRam: server.ramUsed,
  };
  allocator.freeRam = allocator.maxRam - allocator.usedRam - allocator.allocatedRam;

  allocatedServers.set(hostname, allocator);
  return allocator;
}

export function getAllocationServerList(ns: NS, servers: string[]): ServerAllocation[] {
  const list: ServerAllocation[] = [];
  servers.forEach(server => list.push(getAllocationServer(ns, server)));
  return list;
}

export function getExecutorAllocators(ns: NS, rootName: string, exclude: string[]): ServerAllocation[] {
  const servers = getExecutors(ns, rootName, exclude);
  return getAllocationServerList(ns, servers);
}

export class AllocationBuffer {
  ns: NS;
  executors: Map<string, ScriptTemplate[]>;
  ramLimit: number;

  constructor(ns: NS, allowedRamUsagePercent = 100) {
    this.ns = ns;
    this.ramLimit = allowedRamUsagePercent / 100 * getTotalRam(ns);

    this.executors = new Map();

    this.ns.atExit(() => {
      this.clear()
    }, "clearBuffer")
  }

  getThreadsUntilRamLimit(script: ScriptTemplate): number {
    const ram = this.ns.getScriptRam(script.filename, "home");
    const threads = script.threads ?? 1;
    const ramUsage = ram * threads;

    return Math.floor(this.ramLimit / ramUsage)
  }

  allocate(script: ScriptTemplate): boolean {
    const ramCost = this.ns.getScriptRam(script.filename, "home");

    const allocators = getExecutorAllocators(this.ns, "home", ["home"])
      .filter(server => server.freeRam >= ramCost)
      .sort((a, b) => a.maxRam - b.freeRam);

    if (allocators.length <= 0) return false;
    const allocator: ServerAllocation = allocators[0];

    allocator.allocatedRam += ramCost;
    this.executors.set(
      allocator.hostname,
      (this.executors.get(allocator.hostname) ?? []).concat(script)
    )

    return true;
  }

  allocateUpToThreads(script: ScriptTemplate, threads: number): number {
    const scriptRam = this.ns.getScriptRam(script.filename, "home")
    let needToBeAllocated = threads;

    const allocators = getExecutorAllocators(this.ns, "home", ["home"])
      .sort((a, b) => b.maxRam - a.maxRam);

    for (const server of allocators) {
      if (needToBeAllocated <= 0) break;

      const canRun = Math.floor(server.freeRam / scriptRam);
      if (canRun <= 0) continue;
      const allocatedThreads = Math.min(needToBeAllocated, canRun);

      const s: ScriptTemplate = { ...script, threads: allocatedThreads }

      this.executors.set(
        server.hostname,
        (this.executors.get(server.hostname) ?? []).concat(s)
      )

      server.allocatedRam += allocatedThreads * scriptRam;
      needToBeAllocated -= allocatedThreads;
    }

    return threads - needToBeAllocated;
  }

  execute(): Script[] {
    this.mergeThreads();

    const scriptList: Script[] = []

    this.executors.forEach((scripts: Script[], hostname: string) => {
      scripts.forEach(script => {
        scriptList.push(runScriptOnServer(this.ns, hostname, script))
        this.clearAllocation(script, hostname);
      })
    })
    this.executors.clear()

    return scriptList;
  }

  private mergeThreads(): void {
    for (const [hostname, scripts] of this.executors) {
      const merged: ScriptTemplate[] = [];

      for (const script of scripts) {
        const existing: Script | undefined = merged.find(s => haveScriptsSameArgs(s, script));
        if (existing) {
          existing.threads = (existing.threads ?? 1) + (script.threads ?? 1);
        } else {
          merged.push({ ...script })
        }
      }

      this.executors.set(hostname, merged);
    }
  }

  clearAllocation(script: ScriptTemplate, hostname: string) {
    const scripts = this.executors.get(hostname) ?? [];

    for (let i = 0; i < scripts.length; i++) {
      const s = scripts[i]
      if (s !== script) continue;

      scripts.splice(i, 1);

      const ramCost = this.ns.getScriptRam(s.filename)
      const threads = s.threads ?? 1;
      const allocator = getAllocationServer(this.ns, hostname)
      allocator.allocatedRam -= ramCost * threads;
      break;
    }
  }

  clear() {
    for (const [hostname, scripts] of this.executors) {
      scripts.forEach(script => this.clearAllocation(script, hostname))
    }
  }
}

// buffer = network.createBuff(ns)
//
// buffer.allocate(script1)
// buffer.allocate(script2)
//
// const couldRun = buffer.getThreadsUntilRamLimit(script3, ramLimit)
// const shouldRun = Math.min(couldRun, needed);
//
// buffer.allocateUntilRamLimit(script3, ramLimit)
// buffer.allocateUntilThreadCount(script, shouldRun)

// network.execute(buffer)
// buffer.execute(ns)
