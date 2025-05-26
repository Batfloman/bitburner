import { NS } from "@ns"
import { getTotalRam } from "/util/network";
import { AllocationBuffer } from "/util/network2";
import { getRamCost, findRunningScript, Script, ScriptTemplate } from "/util/scripts";
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
    if (!targetName) {
      ns.clearLog()
      ns.printf("All targets minimized!")
      await ns.sleep(1000);
      continue;
    }

    await minimize(ns, targetName, running);

    await ns.sleep(1);
  }
}

async function minimize(ns: NS, targetName: string, running: Map<string, Script[]>) {
  while (!isWeakend(ns, targetName) || !isMoneyMaxed(ns, targetName)) {
    ns.clearLog();

    // info data
    const time_weaken = ns.getWeakenTime(targetName);
    const time_grow = ns.getGrowTime(targetName);

    for (const script of running.get(GROW)) {
      if (!script.status?.starttime || !script.duration) continue;
      const elapsed = Date.now() - script.status.starttime
      const timeleft = script.duration - elapsed;
      if (timeleft > time_grow) ns.kill(script.status.pid)
    }
    for (const script of running.get(WEAK)) {
      if (!script.status?.starttime || !script.duration) continue;
      const elapsed = Date.now() - script.status.starttime
      const timeleft = script.duration - elapsed;
      if (timeleft > time_weaken) ns.kill(script.status.pid)
    }

    for (const [filename, scripts] of running) {
      running.set(filename, scripts.filter(s => ns.isRunning(s.status?.pid ?? 0)))
    }

    let runningGrow = running.get(GROW) ?? [];
    let runningWeak = running.get(WEAK) ?? [];

    const runningWeak_threads = runningWeak.reduce((sum, script: Script) => sum + (script.threads ?? 1), 0);
    const runningGrow_threads = runningGrow.reduce((sum, script: Script) => sum + (script.threads ?? 1), 0);

    let neededWeak = neededWeakenThreads(ns, targetName);
    if (runningGrow_threads > 0) {
      let sec_increase = ns.growthAnalyzeSecurity(runningGrow_threads, targetName);
      neededWeak += calculateWeakenThreads(ns, sec_increase)
    }
    neededWeak = Math.ceil(neededWeak);

    const neededGrow = Math.ceil(neededGrowThreads(ns, targetName));


    // print

    const server = ns.getServer(targetName);
    // ns.print(findRunningScript(ns, "brain/weak.js", targetName))
    ns.printf("====+ %s =====\n", targetName);
    ns.printf("--- grow ---");
    ns.printf("   Running: %d / %d", runningGrow_threads, neededGrow);
    ns.printf("   Time: %s", ns.tFormat(time_grow))
    ns.printf("   Money: %s / %s", ns.formatNumber(server.moneyAvailable), ns.formatNumber(server.moneyMax));
    ns.printf("--- weaken ---");
    ns.printf("   Running: %d / %d", runningWeak_threads, neededWeak);
    ns.printf("   Time: %s", ns.tFormat(time_weaken))
    ns.printf("   Security: %.2f / %.2f", server.hackDifficulty, server.minDifficulty);

    // ==================================================
    // RAM

    const threshold = .5 * getTotalRam(ns);
    const [isAbove, cur] = isAboveThreshold(ns, threshold, running);
    ns.printf("Used %s < %s / %s", ns.formatRam(cur), ns.formatRam(threshold), ns.formatRam(getTotalRam(ns)))

    if (isAbove) {
      await ns.sleep(100);
      continue;
    }

    // ==================================================

    // minimize

    const buffer = new AllocationBuffer(ns, 50);

    if (runningWeak_threads < neededWeak) {
      const template: ScriptTemplate = { filename: WEAK, args: [targetName], duration: time_weaken }
      const missing = neededWeak - runningWeak_threads;
      const could = buffer.getThreadsUntilRamLimit(template)
      const runThreads = Math.min(missing, could);
      buffer.allocateUpToThreads(template, runThreads);
    }

    if (runningWeak_threads >= neededWeak && runningGrow_threads < neededGrow) {
      ns.print("GROW")
      const template: ScriptTemplate = { filename: GROW, args: [targetName], duration: time_grow }
      const missing = neededGrow - runningGrow_threads;

      const could = buffer.getThreadsUntilRamLimit(template)
      const runThreads = Math.min(missing, could);

      buffer.allocateUpToThreads(template, runThreads);
    }

    const executedScripts = buffer.execute();

    const executedWeak = executedScripts.filter(s => s.filename === WEAK);
    const executedGrow = executedScripts.filter(s => s.filename === GROW);

    running.set(GROW, runningGrow.concat(executedGrow))
    running.set(WEAK, runningWeak.concat(executedWeak))

    await ns.sleep(50);
  }
}

function isAboveThreshold(ns: NS, threshold: number, running: Map<string, Script[]>): [boolean, number] {
  let sum = 0;
  running.forEach((scripts, _) => { sum += getRamCost(ns, ...scripts) })

  return [sum >= threshold, sum];
}
