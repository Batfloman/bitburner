import { NS, } from "@ns"
import { appendToMap } from "./helperfunctions";
import { getTotalRam, runScriptsUpToCount } from "./network";
import { getRamCost, haveScriptsSameArgs, runScriptOnServer, Script, ScriptTemplate } from "./scripts"
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
  allocating: Map<string, ScriptTemplate[]>;
  ramLimit: number;
  running: Map<string, Script[]>;

  constructor(ns: NS, allowedRam: number, running: Map<string, Script[]> = new Map()) {
    this.ns = ns;
    this.ramLimit = allowedRam;
    this.running = running;

    this.allocating = new Map();

    this.ns.atExit(() => {
      this.clear()
    }, "clearBuffer")
  }

  update(): void {
    for (const [hostname, scripts] of this.running) {
      this.running.set(hostname, scripts.filter(s => this.ns.isRunning(s.status?.pid ?? 0)))
    }
  }

  updateRamLimit(limit: number): void {
    this.ramLimit = limit;
  }

  getTotalUsedRam(): number {
    let sum = 0;
    this.running.forEach((scripts, _) => { sum += getRamCost(this.ns, ...scripts) })

    return sum;
  }

  getFreeRam(): number {
    return this.ramLimit - this.getTotalUsedRam();
  }

  canAllocate(script: ScriptTemplate): boolean {
    const cost = getRamCost(this.ns, script);
    return this.getFreeRam() > cost;
  }

  getThreadsUntilRamLimit(script: ScriptTemplate): number {
    return Math.floor(this.getFreeRam() / getRamCost(this.ns, script));
  }

  getRunningThreadCount(script: ScriptTemplate): number {
    let count = 0;

    this.running.forEach((scripts: Script[], _) => {
      scripts.forEach(s => {
        if (haveScriptsSameArgs(s, script)) count += s.threads ?? 1;
      })
    })

    return count;
  }

  allocate(script: ScriptTemplate): boolean {

    const ramCost = this.ns.getScriptRam(script.filename, "home");

    const allocators = getExecutorAllocators(this.ns, "home", ["home"])
      .filter(server => server.freeRam >= ramCost)
      .sort((a, b) => a.maxRam - b.freeRam);

    if (allocators.length <= 0) return false;
    const allocator: ServerAllocation = allocators[0];

    appendToMap<string, ScriptTemplate>(this.allocating, allocator.hostname, script)
    allocator.allocatedRam += ramCost;

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

      appendToMap<string, ScriptTemplate>(this.allocating, server.hostname, s)
      server.allocatedRam += allocatedThreads * scriptRam;
      needToBeAllocated -= allocatedThreads;
    }

    return threads - needToBeAllocated;
  }

  execute(): Script[] {
    this.mergeThreads();

    const scriptList: Script[] = []

    this.allocating.forEach((scripts: Script[], hostname: string) => {
      scripts.forEach(script => {
        const s = runScriptOnServer(this.ns, hostname, script)
        scriptList.push(s)
        appendToMap<string, Script>(this.running, hostname, s)
        this.clearAllocation(script, hostname);
      })
    })
    this.allocating.clear()

    return scriptList;
  }

  private mergeThreads(): void {
    for (const [hostname, scripts] of this.allocating) {
      const merged: ScriptTemplate[] = [];

      for (const script of scripts) {
        const existing: Script | undefined = merged.find(s => haveScriptsSameArgs(s, script));
        if (existing) {
          existing.threads = (existing.threads ?? 1) + (script.threads ?? 1);
        } else {
          merged.push({ ...script })
        }
      }

      this.allocating.set(hostname, merged);
    }
  }

  clearAllocation(script: ScriptTemplate, hostname: string) {
    const scripts = this.allocating.get(hostname) ?? [];

    for (let i = 0; i < scripts.length; i++) {
      const s = scripts[i]
      if (s !== script) continue;

      scripts.splice(i, 1);

      const cost = getRamCost(this.ns, s);
      const allocator = getAllocationServer(this.ns, hostname)
      allocator.allocatedRam -= cost;
      break;
    }
  }

  clear() {
    for (const [hostname, scripts] of this.allocating) {
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
