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

export function getTotalRam(ns: NS, includeHome = false) {
  const servers = includeHome ? get_subservers(ns, "home") : get_subservers(ns, "home", new Set(["home"]));

  let ram = 0
  servers
    .map(server => ns.getServer(server))
    .forEach(server => {
      ram += server.maxRam;
    })

  return ram;
}
