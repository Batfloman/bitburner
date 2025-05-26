import { NS, Server } from "@ns";
import { getTotalFreeRAM, getTotalRam, getTotalUsedRAM } from "./util/network";
import { getFreeRAM, getMoneyPerSec, get_Access } from "./util/servers";
import { find_minimizer_target, find_target, get_subservers } from "./util/subservers";

export async function main(ns: NS): Promise<void> {
  ns.disableLog("ALL")
  ns.ui.openTail();

  const tailwidth = 666;
  const tailheight = 250;
  const [w_width, w_height] = ns.ui.windowSize()
  ns.ui.moveTail(1 * w_width - tailwidth - 25, .4 * w_height)
  ns.ui.resizeTail(tailwidth, tailheight)

  while (true) {
    ns.clearLog();

    const servers = get_subservers(ns, "home", new Set(["home"]))
      .filter(server => get_Access(ns, server))
      .map(server => ns.getServer(server))
      .filter(server => !server.purchasedByPlayer)
      .filter(server => (server.requiredHackingSkill || 0) < ns.getPlayer().skills.hacking)

    ns.printf("| %-16s | %-6s | %-20s | %13s |", "name", "Sec", "Money", "Money per sec",);
    servers.forEach(server => printInfo(ns, server));

    ns.printf("target   %s", find_target(ns))
    ns.printf("minimize %s", find_minimizer_target(ns))

    ns.printf("Used %.2f: %s / %s", getTotalUsedRAM(ns) / getTotalRam(ns), ns.formatRam(getTotalUsedRAM(ns)), ns.formatRam(getTotalRam(ns)))

    await ns.sleep(10);
  }
}

function printInfo(ns: NS, server: Server): void {
  // const usedRam = ns.formatRam(server.ramUsed);
  // const maxRam = ns.formatRam(server.maxRam);
  // const string_ram = `${usedRam} / ${maxRam}`;

  const sec = server.hackDifficulty || server.minDifficulty || 0;
  const minSec = server.minDifficulty || 0;
  const above = sec - minSec;
  const string_sec = `+${above.toFixed(2)}`;

  const money = server.moneyAvailable || 0
  const string_current_money = ns.formatNumber(money);
  const maxMoney = ns.formatNumber(server.moneyMax || 0);
  const string_money = `${string_current_money} / ${maxMoney}`;

  const string_money_per_sec = ns.formatNumber(getMoneyPerSec(ns, server.hostname));

  ns.printf("| %-16s | %6s | %20s | %13s |", server.hostname, string_sec, string_money, string_money_per_sec);
}
