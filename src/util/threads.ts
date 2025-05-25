import { NS, Server } from "@ns";

export function neededWeakenThreads(ns: NS, hostName: string) {
  const server = ns.getServer(hostName);

  const cur = server.hackDifficulty || server.minDifficulty || 0;
  const min = server.minDifficulty || 0
  const diff = cur - min;
  return calculateWeakenThreads(ns, diff)
}

export function calculateWeakenThreads(ns: NS, security_surplus: number) {
  let count = 1;
  while (ns.weakenAnalyze(count) < security_surplus) count++;
  return count
}


export function neededGrowThreads(ns: NS, hostname: string) {
  const server = ns.getServer(hostname);

  let count = 1;

  const mult = server.moneyMax / server.moneyAvailable;
  return ns.growthAnalyze(hostname, mult);
}
