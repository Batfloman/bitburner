import { NS } from "@ns";
import { getMoneyPerSec, get_Access, isMoneyMaxed, isWeakend } from "./servers";

export async function main(ns: NS) {
  const found = get_subservers(ns, "home");
  ns.tprint(found);
}

export function get_subservers(ns: NS, rootName: string, excluded: Set<string> = new Set(), found: Set<string> = new Set()): string[] {
  if (!excluded.has(rootName)) {
    found.add(rootName);
  }

  ns.scan(rootName)
    .filter(a => !found.has(a))
    .forEach((sub) => {
      get_subservers(ns, sub, excluded, found);
    })

  return Array.from(found);
}

export function getExecutors(ns: NS, rootName: string, excluded: string[]): string[] {
  const excludedSet = new Set(excluded);
  return get_subservers(ns, rootName, excludedSet)
    .filter(server => get_Access(ns, server))
}

export function find_target(ns: NS) {
  const servers = get_subservers(ns, "home", new Set(["home"]))
    .filter(server => get_Access(ns, server))
    .map(server => ns.getServer(server))
    .filter(server => !server.purchasedByPlayer)
    .filter(server => (server.requiredHackingSkill || 0) < ns.getPlayer().skills.hacking)

  servers.sort((a, b) => getMoneyPerSec(ns, b.hostname) - getMoneyPerSec(ns, a.hostname));
  return servers[0].hostname
}

export function find_minimizer_target(ns: NS) {
  const servers = get_subservers(ns, "home", new Set(["home"]))
    .filter(server => get_Access(ns, server))
    .map(server => ns.getServer(server))
    .filter(server => !server.purchasedByPlayer)
    .filter(server => (server.requiredHackingSkill || 0) < ns.getPlayer().skills.hacking)
    .filter(server => !isWeakend(ns, server.hostname) || !isMoneyMaxed(ns, server.hostname))

  servers.sort((a, b) => a.moneyMax - b.moneyMax);
  return servers[0].hostname
}
