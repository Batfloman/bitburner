import { NS } from "@ns"
import { getTotalRam } from "/util/network";
import { AllocationBuffer } from "/util/network2";
import { getRamCost, findRunningScript, Script, ScriptTemplate } from "/util/scripts";
import { getAccess, getSecuritySurplus, isMoneyMaxed, isWeakend } from "/util/servers";
import { find_minimizer_target, getSubservers as getSubservers } from "/util/subservers"
import { calculateWeakenThreads, neededGrowThreads, neededWeakenThreads } from "/util/threads";

const WEAK = "brain/weak.js";

export async function main(ns: NS): Promise<void> {
  positionTail(ns);

  const running: Map<string, Script[]> = new Map();
  {
    const targets = getTargets(ns);
    targets.forEach(target => {
      const scripts = findRunningScript(ns, WEAK, target)
      running.set(target, scripts)
    })
  }

  const allowedRamPercent = 20;
  const buffer = new AllocationBuffer(ns, 0, running);

  while (true) {
    const targets = getTargets(ns);
    buffer.update();
    buffer.updateRamLimit(allowedRamPercent / 100 * getTotalRam(ns));

    printInfos(ns, targets, buffer);

    if (targets.length <= 0) {
      await ns.sleep(500);
      continue;
    }

    targets.sort((a, b) => getSecuritySurplus(ns, a) - getSecuritySurplus(ns, b))
      .forEach(target => {
        const weakenTime = ns.getWeakenTime(target);
        const scriptTemplate: ScriptTemplate = { filename: WEAK, args: [target], duration: weakenTime }

        if (!buffer.canAllocate(scriptTemplate)) return;

        const totalNeeded = neededWeakenThreads(ns, target);
        const needed = totalNeeded - buffer.getRunningThreadCount(scriptTemplate);
        const couldRun = buffer.getThreadsUntilRamLimit(scriptTemplate);
        const threads = Math.min(needed, couldRun);

        buffer.allocateUpToThreads(scriptTemplate, threads);
      })

    buffer.execute()

    await ns.sleep(100)
  }
}

function positionTail(ns: NS) {
  ns.disableLog("ALL");
  ns.ui.openTail();
}

function printInfos(ns: NS, targets: string[], buffer: AllocationBuffer) {
  ns.clearLog()

  if (targets.length > 0) {
    ns.printf("| %-18s | %-s", "Name", "Security")
    for (const server of targets) {
      const template: ScriptTemplate = { filename: WEAK, args: [server] }
      const threads = buffer.getRunningThreadCount(template)
      const sec = getSecuritySurplus(ns, server);
      const neededThreads = neededWeakenThreads(ns, server);
      ns.printf("| %-18s | +%.2f | %d < %d", server, sec, threads, neededThreads)
    }
  } else {
    ns.print("No Targets!")
  }

  ns.printf("Used %s < %s / %s", ns.formatRam(buffer.getTotalUsedRam()), ns.formatRam(buffer.ramLimit), ns.formatRam(getTotalRam(ns)))
}

function getTargets(ns: NS): string[] {
  return getSubservers(ns, "home", ["home"])
    .filter(s => getAccess(ns, s))
    .filter(s => getSecuritySurplus(ns, s) > 1)
}

async function minimize(ns: NS, targetName: string, running: Map<string, Script[]>) {
  // while (!isWeakend(ns, targetName) || !isMoneyMaxed(ns, targetName)) {
  //   ns.clearLog();

  // info data
  // const time_weaken = ns.getWeakenTime(targetName);
  // const time_grow = ns.getGrowTime(targetName);

  // for (const script of running.get(GROW)) {
  //   if (!script.status?.starttime || !script.duration) continue;
  //   const elapsed = Date.now() - script.status.starttime
  //   const timeleft = script.duration - elapsed;
  //   if (timeleft > time_grow) ns.kill(script.status.pid)
  // }
  // for (const script of running.get(WEAK)) {
  //   if (!script.status?.starttime || !script.duration) continue;
  //   const elapsed = Date.now() - script.status.starttime
  //   const timeleft = script.duration - elapsed;
  //   if (timeleft > time_weaken) ns.kill(script.status.pid)
  // }

  // for (const [filename, scripts] of running) {
  //   running.set(filename, scripts.filter(s => ns.isRunning(s.status?.pid ?? 0)))
  // }

  // let runningGrow = running.get(GROW) ?? [];
  // let runningWeak = running.get(WEAK) ?? [];
  //
  // const runningWeak_threads = runningWeak.reduce((sum, script: Script) => sum + (script.threads ?? 1), 0);
  // const runningGrow_threads = runningGrow.reduce((sum, script: Script) => sum + (script.threads ?? 1), 0);
  //
  // let neededWeak = neededWeakenThreads(ns, targetName);
  // if (runningGrow_threads > 0) {
  //   let sec_increase = ns.growthAnalyzeSecurity(runningGrow_threads, targetName);
  //   neededWeak += calculateWeakenThreads(ns, sec_increase)
  // }
  // neededWeak = Math.ceil(neededWeak);
  //
  // const neededGrow = Math.ceil(neededGrowThreads(ns, targetName));


  // print

  // const server = ns.getServer(targetName);
  // ns.print(findRunningScript(ns, "brain/weak.js", targetName))
  // ns.printf("====+ %s =====\n", targetName);
  // ns.printf("--- grow ---");
  // ns.printf("   Running: %d / %d", runningGrow_threads, neededGrow);
  // ns.printf("   Time: %s", ns.tFormat(time_grow))
  // ns.printf("   Money: %s / %s", ns.formatNumber(server.moneyAvailable), ns.formatNumber(server.moneyMax));
  // ns.printf("--- weaken ---");
  // ns.printf("   Running: %d / %d", runningWeak_threads, neededWeak);
  // ns.printf("   Time: %s", ns.tFormat(time_weaken))
  // ns.printf("   Security: %.2f / %.2f", server.hackDifficulty, server.minDifficulty);

  // ==================================================
  // RAM

  // const threshold = .5 * getTotalRam(ns);
  // const [isAbove, cur] = isAboveThreshold(ns, threshold, running);
  // ns.printf("Used %s < %s / %s", ns.formatRam(cur), ns.formatRam(threshold), ns.formatRam(getTotalRam(ns)))
  //
  // if (isAbove) {
  //   await ns.sleep(100);
  //   continue;
  // }

  // ==================================================

  // minimize

  // const buffer = new AllocationBuffer(ns, 50);
  //
  // if (runningWeak_threads < neededWeak) {
  //   const template: ScriptTemplate = { filename: WEAK, args: [targetName], duration: time_weaken }
  //   const missing = neededWeak - runningWeak_threads;
  //   const could = buffer.getThreadsUntilRamLimit(template)
  //   const runThreads = Math.min(missing, could);
  //   buffer.allocateUpToThreads(template, runThreads);
  // }
  //
  // if (runningWeak_threads >= neededWeak && runningGrow_threads < neededGrow) {
  //   ns.print("GROW")
  //   const template: ScriptTemplate = { filename: GROW, args: [targetName], duration: time_grow }
  //   const missing = neededGrow - runningGrow_threads;
  //
  //   const could = buffer.getThreadsUntilRamLimit(template)
  //   const runThreads = Math.min(missing, could);
  //
  //   buffer.allocateUpToThreads(template, runThreads);
  // }
  //
  // const executedScripts = buffer.execute();
  //
  // const executedWeak = executedScripts.filter(s => s.filename === WEAK);
  // const executedGrow = executedScripts.filter(s => s.filename === GROW);
  //
  // running.set(GROW, runningGrow.concat(executedGrow))
  // running.set(WEAK, runningWeak.concat(executedWeak))
  //
  // await ns.sleep(50);
  // }
}
