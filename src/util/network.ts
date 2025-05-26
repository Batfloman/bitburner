import { NS } from "@ns";
import { getSubservers } from "./subservers";


export function getTotalFreeRAM(ns: NS, includeHome = false) {
  const servers = includeHome ? getSubservers(ns, "home") : getSubservers(ns, "home", ["home"]);

  let freeRam = 0
  servers
    .map(server => ns.getServer(server))
    .forEach(server => {
      freeRam += server.maxRam - server.ramUsed;
    })

  return freeRam;
}

export function getTotalUsedRAM(ns: NS, includeHome = false) {
  const servers = includeHome ? getSubservers(ns, "home") : getSubservers(ns, "home", ["home"]);

  let usedRam = 0
  servers
    .map(server => ns.getServer(server))
    .forEach(server => {
      usedRam += server.ramUsed;
    })

  return usedRam;
}

export function getTotalRam(ns: NS, includeHome = false) {
  const servers = includeHome ? getSubservers(ns, "home") : getSubservers(ns, "home", ["home"]);

  let ram = 0
  servers
    .map(server => ns.getServer(server))
    .forEach(server => {
      ram += server.maxRam;
    })

  return ram;
}
