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

  allocate(script: Script): Script | undefined {
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

    return script;
  }

  allocateUpToThreads(script: Script, threads: number): Script[] {
    const list: Script[] = []

    const scriptRam = this.ns.getScriptRam(script.filename, "home")
    let needToBeAllocated = threads;

    const allocators = getExecutorAllocators(this.ns, "home", ["home"])
      .sort((a, b) => b.maxRam - a.maxRam);

    for (const server of allocators) {
      if (needToBeAllocated <= 0) break;

      this.ns.print(server.freeRam, " < ", server.maxRam, " | ", server.allocatedRam)
      const canRun = Math.floor(server.freeRam / scriptRam);
      this.ns.print(server.hostname, " can run ", canRun);
      const threads = Math.min(canRun, needToBeAllocated);

      const s: Script = {
        ...script,
        opts: {
          ...script.opts,
          threads: threads,
        }
      }

      list.push(s)
      this.executors.set(
        server.hostname,
        (this.executors.get(server.hostname) ?? []).concat(s)
      )

      needToBeAllocated -= threads;
    }

    return list;
  }

  execute(): void {
    this.executors.forEach((scripts: Script[], hostname: string) => {
      scripts.forEach(script => {
        runScriptOnServer(this.ns, hostname, script);
        this.clearAllocation(script, hostname);
      })
    })
    this.executors.clear()
  }

  clearAllocation(script: Script, hostname: string) {
    const scripts = this.executors.get(hostname) ?? [];

    for (let i = 0; i < scripts.length; i++) {
      const s = scripts[i]
      if (s !== script) continue;

      scripts.splice(i, 1);

      const ramCost = this.ns.getScriptRam(s.filename)
      const threads = s.opts?.threads ?? 1;
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
