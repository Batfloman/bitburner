import { NS } from "@ns";

export function isWeakend(ns: NS, hostname: string): boolean {
  if (!ns.serverExists(hostname)) {
    ns.ui.openTail();
    ns.printf("%s is not a valid hostname", hostname);
    ns.exit();
  }

  const server = ns.getServer(hostname);

  const cur = server.hackDifficulty || server.minDifficulty || 0;
  const min = server.minDifficulty || 0;
  return cur <= min;
}

export function isMoneyMaxed(ns: NS, hostname: string): boolean {
  if (!ns.serverExists(hostname)) {
    ns.ui.openTail();
    ns.printf("%s is not a valid hostname", hostname);
    ns.exit();
  }

  const server = ns.getServer(hostname);

  const cur = server.moneyAvailable || 0;
  const max = server.moneyMax || 0;
  return cur >= max;
}

export function get_Access(ns: NS, rootName: string): boolean {
  const server = ns.getServer(rootName);

  if (!server.sshPortOpen && ns.fileExists("BruteSSH.exe")) ns.brutessh(rootName);
  if (!server.ftpPortOpen && ns.fileExists("FTPCrack.exe")) ns.ftpcrack(rootName);
  if (!server.smtpPortOpen && ns.fileExists("relaySMTP.exe")) ns.relaysmtp(rootName);
  if (!server.httpPortOpen && ns.fileExists("HTTPWorm.exe")) ns.httpworm(rootName);
  if (!server.sqlPortOpen && ns.fileExists("SQLInject.exe")) ns.sqlinject(rootName);

  const enoughPorts = (server.openPortCount || 0) >= (server.numOpenPortsRequired || 0)
  if (!server.hasAdminRights && enoughPorts) {
    ns.nuke(rootName);
  }

  return server.hasAdminRights;
}

export function validateHostname(ns: NS, hostname: string): void {
  if (!ns.serverExists(hostname)) {
    ns.ui.openTail();
    ns.printf("%s is not a valid Server name")
    ns.exit();
  }
}

export function getFreeRAM(ns: NS, hostname: string): number {
  validateHostname(ns, hostname);

  const server = ns.getServer(hostname);

  return server.maxRam - server.ramUsed;
}

export function getMoneyPerSec(ns: NS, hostname: string) {
  const hackAna = ns.getServerMoneyAvailable(hostname) * ns.hackAnalyze(hostname)
  const hackTime = ns.getHackTime(hostname)
  return hackAna / hackTime * 1000;
}
