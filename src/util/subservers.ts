import { NS } from "@ns";
import { getMoneyPerSec, getAccess, isMoneyMaxed, isWeakend } from "./servers";

export async function main(ns: NS) {
  const found = getSubservers(ns, "home");
  ns.tprint(found);
}

export function getSubservers(ns: NS, rootName: string, excluded: string[] = [], found: Set<string> = new Set()): string[] {
  if (!new Set(excluded).has(rootName)) {
    found.add(rootName);
  }

  ns.scan(rootName)
    .filter(a => !found.has(a))
    .forEach((sub) => {
      getSubservers(ns, sub, excluded, found);
    })

  return Array.from(found);
}

export function getExecutors(ns: NS, rootName: string, excluded: string[]): string[] {
  const excludedSet = new Set(excluded);
  return getSubservers(ns, rootName, excludedSet)
    .filter(server => getAccess(ns, server))
}

export function find_target(ns: NS) {
  const servers = getSubservers(ns, "home", new Set(["home"]))
    .filter(server => getAccess(ns, server))
    .map(server => ns.getServer(server))
    .filter(server => !server.purchasedByPlayer)
    .filter(server => (server.requiredHackingSkill || 0) < ns.getPlayer().skills.hacking)

  servers.sort((a, b) => getMoneyPerSec(ns, b.hostname) - getMoneyPerSec(ns, a.hostname));
  return servers[0].hostname
}

export function find_minimizer_target(ns: NS) {
  const servers = getSubservers(ns, "home", ["home"])
    .filter(server => getAccess(ns, server))
    .map(server => ns.getServer(server))
    .filter(server => !server.purchasedByPlayer)
    .filter(server => (server.requiredHackingSkill || 0) < ns.getPlayer().skills.hacking)
    .filter(server => !isWeakend(ns, server.hostname) || !isMoneyMaxed(ns, server.hostname))

  if (servers.length <= 0) return;

  servers.sort((a, b) => a.moneyMax - b.moneyMax);
  return servers[0].hostname
}
