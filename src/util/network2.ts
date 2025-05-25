import { NS, } from "@ns"
import { getTotalRAM } from "./network";
import { haveScriptsSameArgs, runScriptOnServer, Script } from "./scripts"
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

export function getExecutorAllocators(ns: NS, rootName: string, exclude: string[]) {
  const servers = getExecutors(ns, rootName, exclude);
  return getAllocationServerList(ns, servers);
}

export class AllocationBuffer {
  ns: NS;
  executors: Map<string, Script[]>;
  ramLimit: number;

  constructor(ns: NS, allowedRamUsagePercent = 100) {
    this.ns = ns;
    this.ramLimit = allowedRamUsagePercent / 100 * getTotalRAM(ns);

    this.executors = new Map();

    this.ns.atExit(() => {
      this.clear()
    }, "clearBuffer")
  }

  getThreadsUntilRamLimit(script: Script): number {
    const ram = this.ns.getScriptRam(script.filename, "home");
    const threads = script.opts?.threads ?? 1;
    const ramUsage = ram * threads;

    return Math.floor(this.ramLimit / ramUsage)
  }

  allocate(script: Script): void {
    const ramCost = this.ns.getScriptRam(script.filename, "home");

    const allocators = getExecutorAllocators(this.ns, "home", ["home"])
      .filter(server => server.freeRam >= ramCost)
      .sort((a, b) => a.freeRam - b.freeRam);

    if (allocators.length <= 0) return;
    const allocator: ServerAllocation = allocators[0];

    allocator.allocatedRam += ramCost;
    this.executors.set(
      allocator.hostname,
      (this.executors.get(allocator.hostname) ?? []).concat(script)
    )
  }

  execute() {
    this.simplify()

    this.executors.forEach((scripts: Script[], hostname: string) => {
      scripts.forEach(script => {
        runScriptOnServer(this.ns, hostname, script);
        this.clearAllocation(script, hostname);
      })
    })
    this.executors.clear()
  }

  clearAllocation(script: Script, hostname: string) {
    const ramCost = this.ns.getScriptRam(script.filename)
    const threads = script.opts?.threads ?? 1;
    const allocator = getAllocationServer(this.ns, hostname)
    allocator.allocatedRam -= ramCost * threads;
  }

  clear() {
    for (const [hostname, scripts] of this.executors) {
      scripts.forEach(script => this.clearAllocation(script, hostname))
    }
  }

  private simplify() {
    for (const [hostname, scripts] of this.executors) {
      const merged: Script[] = [];

      for (const script of scripts) {
        const existing = merged.find(s => haveScriptsSameArgs(s, script));
        if (existing) {
          const threads1 = existing.opts?.threads ?? 1
          const threads2 = script.opts?.threads ?? 1
          existing.opts = {
            ...existing.opts,
            threads: threads1 + threads2,
          }
        } else {
          merged.push({ ...script }); // Kopie!
        }
      }

      this.executors.set(hostname, merged);
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
