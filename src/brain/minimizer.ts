import { NS } from "@ns"
import { getTotalRAM, runScriptsOnFreeServer, runScriptsUntilRamLimit } from "/util/network";
import { AllocationBuffer } from "/util/network2";
import { calculateRamCost, findRunningScript, Script } from "/util/scripts";
import { isMoneyMaxed, isWeakend } from "/util/servers";
import { find_minimizer_target } from "/util/subservers"
import { calculateWeakenThreads, neededGrowThreads, neededWeakenThreads } from "/util/threads";

const GROW = "brain/grow.js";
const WEAK = "brain/weak.js";

export async function main(ns: NS): Promise<void> {
  ns.disableLog("ALL");
  ns.ui.openTail();

  let targetName = find_minimizer_target(ns);
  const running: Map<string, Script[]> = new Map();

  running.set(WEAK, findRunningScript(ns, WEAK, targetName))
  running.set(GROW, findRunningScript(ns, GROW, targetName))


  while (true) {
    // clear old data
    targetName = find_minimizer_target(ns);

    await minimize(ns, targetName, running);

    await ns.sleep(1);
  }
}

async function minimize(ns: NS, targetName: string, running: Map<string, Script[]>) {
  while (!isWeakend(ns, targetName) || !isMoneyMaxed(ns, targetName)) {
    ns.clearLog();

    running.forEach((scripts: Script[], scriptName: string) => {
      running.set(
        scriptName,
        scripts.filter(script => ns.isRunning(script.status?.pid ?? 0))
      )
    })

    // info data

    let runningGrow = running.get(GROW) ?? [];
    let runningWeak = running.get(WEAK) ?? [];

    let neededWeak = neededWeakenThreads(ns, targetName);
    if (runningGrow.length > 0) {
      let sec_increase = ns.growthAnalyzeSecurity(runningGrow.length, targetName);
      neededWeak += calculateWeakenThreads(ns, sec_increase)
    }
    neededWeak = Math.ceil(neededWeak);
    const time_weaken = ns.getWeakenTime(targetName);

    const neededGrow = Math.ceil(neededGrowThreads(ns, targetName));
    const time_grow = ns.getGrowTime(targetName);

    // print

    const server = ns.getServer(targetName);
    // ns.print(findRunningScript(ns, "brain/weak.js", targetName))
    ns.printf("====+ %s =====\n", targetName);
    ns.printf("--- grow ---");
    ns.printf("   Running: %d / %d", runningGrow.length, neededGrow);
    ns.printf("   Time: %s", ns.tFormat(time_grow))
    ns.printf("   Money: %s / %s", ns.formatNumber(server.moneyAvailable), ns.formatNumber(server.moneyMax));
    ns.printf("--- weaken ---");
    ns.printf("   Running: %d / %d", runningWeak.length, neededWeak);
    ns.printf("   Time: %s", ns.tFormat(time_weaken))
    ns.printf("   Security: %.2f / %.2f", server.hackDifficulty, server.minDifficulty);

    // Ram

    const max = getTotalRAM(ns);
    const thresh = .5 * max;

    let cur = 0;
    running.forEach((scripts: Script[], _) => {
      scripts.forEach(script => {
        if (!script.status) return;
        const obj = ns.getRunningScript(script.status?.pid);
        if (!obj) return;
        cur += obj.threads * obj.ramUsage;
      })
    })

    ns.printf("Used %s < %s / %s", ns.formatRam(cur), ns.formatRam(thresh), ns.formatRam(max))
    if (cur > thresh) {
      await ns.sleep(100);
      continue;
    }

    // minimize

    const buffer = new AllocationBuffer(ns, 50);

    const runningWeak_threads = runningWeak.reduce((sum, script: Script) => sum + (script.opts?.threads ?? 1), 0);
    const runningGrow_threads = runningGrow.reduce((sum, script: Script) => sum + (script.opts?.threads ?? 1), 0);

    if (runningWeak_threads < neededWeak) {
      const script: Script = { filename: WEAK, opts: { args: [targetName] } }

      const runThreads = Math.min(neededWeak, buffer.getThreadsUntilRamLimit(script));
      const res: Script[] = buffer.allocateUpToThreads(script, runThreads);
      runningWeak = runningWeak.concat(res);
    }
    if (runningWeak_threads >= neededWeak && runningGrow_threads < neededGrow) {
      const script: Script = { filename: GROW, opts: { args: [targetName] } }

      const runThreads = Math.min(neededGrow, buffer.getThreadsUntilRamLimit(script));
      const res: Script[] = buffer.allocateUpToThreads(script, runThreads);
      runningGrow = runningGrow.concat(res);
    }

    buffer.execute();

    running.set(GROW, runningGrow)
    running.set(WEAK, runningWeak)

    await ns.sleep(1000);
  }
}
