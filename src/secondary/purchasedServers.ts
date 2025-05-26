import { NS } from "@ns";

export async function main(ns: NS): Promise<void> {
  ns.disableLog("sleep")
  ns.ui.openTail();

  const tailwidth = 666;
  const tailheight = 200;
  const [w_width, w_height] = ns.ui.windowSize()
  ns.ui.moveTail(.95 * w_width - tailwidth - 25, 0)
  ns.ui.resizeTail(tailwidth, tailheight)

  renameServers(ns);

  while (true) {
    purchaseServer(ns);
    updgradeServer(ns);

    const servers = ns.getPurchasedServers().map(server => ns.getServer(server))

    ns.clearLog()
    servers.forEach(server => {
      const level = Math.log2(server.maxRam)
      const upgrade_cost = ns.getPurchasedServerUpgradeCost(server.hostname, Math.pow(2, level + 1))
      ns.printf("%15s | lvl: %2d | RAM: %7s / %7s | cost: %s", server.hostname, level, ns.formatRam(server.ramUsed), ns.formatRam(server.maxRam), ns.formatNumber(upgrade_cost))
    })

    await ns.sleep(1)
  }
}

export function purchaseServer(ns: NS): void {
  const count_purchased = ns.getPurchasedServers().length
  const max = ns.getPurchasedServerLimit();
  if (count_purchased >= max) return;

  const priceFactor = 1; // money must equal (price * factor) for purchase

  const price = ns.getPurchasedServerCost(2);
  if (price * priceFactor < ns.getPlayer().money) {
    ns.purchaseServer("new", 2);
  }
}

export function renameServers(ns: NS) {
  const servers = ns.getPurchasedServers()
    .map(server => ns.getServer(server))
    .sort((a, b) => b.maxRam - a.maxRam)

  for (let i = 0; i < servers.length; i++) {
    const name = `purchased_${i}`
    if (servers[i].hostname == name) continue;
    ns.renamePurchasedServer(servers[i].hostname, name)
  }
}

export function updgradeServer(ns: NS) {
  const priceFactor = 1; // money must equal (price * factor) for purchase

  ns.getPurchasedServers()
    .map(server => ns.getServer(server))
    .forEach(server => {
      const ram = server.maxRam;
      const ram_level = Math.log2(ram);
      const new_ram = Math.pow(2, ram_level + 1);

      const price = ns.getPurchasedServerUpgradeCost(server.hostname, new_ram);

      if (price / priceFactor < ns.getPlayer().money) {
        ns.upgradePurchasedServer(server.hostname, new_ram);
      }
    });
}
