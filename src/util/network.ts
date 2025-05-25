import { NS, Server } from "@ns";
import { getExecutors, get_subservers } from "./subservers";
import { runScriptOnServer, Script } from "./scripts";
import { get_Access } from "./servers";


export function getTotalFreeRAM(ns: NS, includeHome = false) {
  const servers = includeHome ? get_subservers(ns, "home") : get_subservers(ns, "home", new Set(["home"]));

  let freeRam = 0
  servers
    .map(server => ns.getServer(server))
    .forEach(server => {
      freeRam += server.maxRam - server.ramUsed;
    })

  return freeRam;
}

export function getTotalUsedRAM(ns: NS, includeHome = false) {
  const servers = includeHome ? get_subservers(ns, "home") : get_subservers(ns, "home", new Set(["home"]));

  let usedRam = 0
  servers
    .map(server => ns.getServer(server))
    .forEach(server => {
      usedRam += server.ramUsed;
    })

  return usedRam;
}

export function getTotalRAM(ns: NS, includeHome = false) {
  const servers = includeHome ? get_subservers(ns, "home") : get_subservers(ns, "home", new Set(["home"]));

  let ram = 0
  servers
    .map(server => ns.getServer(server))
    .forEach(server => {
      ram += server.maxRam;
    })

  return ram;
}

type ServerAllocation = {
  hostname: string,
  maxRam: number,
  usedRam: number,
  allocatedRam: number,
  allocatedScripts: Script[],
}

export function runScriptsOnFreeServer(ns: NS, scripts: Script[]): Script[] {
  const servers = get_subservers(ns, "home", new Set(["home"]))
    .filter(server => get_Access(ns, server))
    .map(server => ns.getServer(server))

  const allocators: ServerAllocation[] = servers.map(server => ({
    hostname: server.hostname,
    maxRam: server.maxRam,
    usedRam: server.ramUsed,
    allocatedRam: 0
  }));

  const scriptExecutor = new Map()

  scripts.forEach(script => {
    const scriptRam = ns.getScriptRam(script.filename);

    for (const allocator of allocators) {
      const free = allocator.maxRam - allocator.usedRam - allocator.allocatedRam;
      if (free >= scriptRam) {
        scriptExecutor.set(
          allocator.hostname,
          (scriptExecutor.get(allocator.hostname) ?? []).concat(script)
        );
        allocator.allocatedRam += scriptRam;
        break;
      }
    }
  });

  scriptExecutor.forEach((scriptArray: Script[], hostname) => {
    scriptArray.forEach(script => runScriptOnServer(ns, hostname, script));
  });

  return scripts;
}

export function runScriptsUntilRamLimit(ns: NS, script: Script, ramLimit: number): Script[] {
  ns.print("RUN UNTIL:")
  ns.print(script)
  ns.print(ramLimit)
  ns.print("===")

  const scriptRam = ns.getScriptRam(script.filename, "home");
  const totalThreads = Math.floor(ramLimit / scriptRam);
  if (totalThreads <= 0) return [];

  const servers = getExecutors(ns, "home", ["home"])
    .map(server => ns.getServer(server))
    .sort((a, b) => b.maxRam - a.maxRam);

  const scriptExecutor: Map<string, Script[]> = new Map();
  const scriptList = [];
  let needToBeExecuted = totalThreads;

  for (let server of servers) {
    if (needToBeExecuted <= 0) break;

    const freeRam = server.maxRam - server.ramUsed;
    const canExecute = Math.min(Math.floor(freeRam / scriptRam), needToBeExecuted);
    if (canExecute <= 0) continue;

    const scriptpart: Script = { ...script, opts: { threads: canExecute } }
    scriptList.push(scriptpart)
    scriptExecutor.set(server.hostname, (scriptExecutor.get(server.hostname) ?? []).concat([scriptpart]))
    needToBeExecuted -= canExecute;
  }

  scriptExecutor.forEach((scriptArray: Script[], hostname) => {
    scriptArray.forEach(script => runScriptOnServer(ns, hostname, script));
  });

  return scriptList;
}

export function runScriptsUpToCount(ns: NS, script: Script, count: number): Script[] {
  const scriptRam = ns.getScriptRam(script.filename, "home");

  const servers = get_subservers(ns, "home", new Set(["home"]))
    .filter(server => get_Access(ns, server))
    .map(server => ns.getServer(server))
    .sort((a, b) => b.maxRam - a.maxRam);

  const scriptExecutor: Map<string, Script[]> = new Map();
  const scriptList = [];
  let needToBeExecuted = count;

  for (let server of servers) {
    if (needToBeExecuted <= 0) break;

    const freeRam = server.maxRam - server.ramUsed;
    const canExecute = Math.min(Math.floor(freeRam / scriptRam), needToBeExecuted);
    if (canExecute <= 0) continue;

    const scriptpart: Script = { ...script, opts: { threads: canExecute } }
    scriptList.push(scriptpart)
    scriptExecutor.set(server.hostname, (scriptExecutor.get(server.hostname) ?? []).concat([scriptpart]))
    needToBeExecuted -= canExecute;
  }

  scriptExecutor.forEach((scriptArray: Script[], hostname) => {
    scriptArray.forEach(script => runScriptOnServer(ns, hostname, script));
  });

  return scriptList;
}

function createAllocators(ns: NS, servers: Server[]): Map<string, ServerAllocation> {
  const map = new Map();

  for (let server of servers) {
    const allocator: ServerAllocation = {
      hostname: server.hostname,
      maxRam: server.maxRam,
      usedRam: server.ramUsed,
      allocatedRam: 0,
      allocatedScripts: [],
    }
    map.set(server, allocator)
  }

  return map
}

function createAllocatorsForExecutors(ns: NS): Map<string, ServerAllocation> {
  const servers = getExecutors(ns, "home", ["home"])
    .map(server => ns.getServer(server))
    .sort((a, b) => b.maxRam - a.maxRam)

  return createAllocators(ns, servers);
}

export function allocateUntilRamLimit(ns: NS, script: Script, ramLimit: number, allocators_: Map<string, ServerAllocation> = undefined): Map<string, ServerAllocation> {
  const allocators = !allocators_ ? createAllocatorsForExecutors(ns) : allocators_;
}

export function allocateMultipleThreads(ns: NS, script: Script, threads: number, allocators_: Map<string, ServerAllocation> = undefined): Map<string, ServerAllocation> {
  const allocators = !allocators_ ? createAllocatorsForExecutors(ns) : allocators_;


}

export function executeAllocator(ns: NS, allocators: Map<string, ServerAllocation>): Script[] {

}
