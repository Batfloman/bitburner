import { NS } from "@ns";

export async function main(ns: NS): Promise<void> {
  ns.ui.openTail();

  while (true) {
    if (ns.hacknet.numNodes() < ns.hacknet.maxNumNodes()) {
      if (ns.getPlayer().money > ns.hacknet.getPurchaseNodeCost()) {
        ns.hacknet.purchaseNode();
      }
    }

    for (let i = 0; i < ns.hacknet.numNodes(); i++) {
      if (ns.getPlayer().money > 10 * ns.hacknet.getLevelUpgradeCost(i)) {
        ns.hacknet.upgradeLevel(i);
      }
    }

    await ns.sleep(10);
  }
}
