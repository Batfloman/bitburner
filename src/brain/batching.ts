import { NS } from "@ns";
import { getTotalRAM, runScriptsOnFreeServer } from "/util/network";
import { Script } from "/util/scripts";
import { find_target } from "/util/subservers";

export async function main(ns: NS): Promise<void> {
  const GROW = "brain/grow.js";
  const WEAK = "brain/weak.js";
  const HACK = "brain/hack.js";

  let targetName = find_target(ns);
  const running: Map<string, Script[]> = new Map();
  ns.disableLog("ALL");

  ns.ui.openTail();

  const TICK_INVERTALL = 10;

  while (true) {
    ns.clearLog();

    // clear old data
    targetName = find_target(ns);

    running.forEach((scripts: Script[], scriptName: string) => {
      running.set(
        scriptName,
        scripts.filter(script => ns.isRunning(script.status?.pid ?? 0))
      )
    })

    // print

    ns.printf("===== %s =====", targetName)

    // Ram

    const max = getTotalRAM(ns);
    const thresh = .5 * max;

    let cur = 0;
    running.forEach((_, scriptName: string) => {
      const ram = ns.getScriptRam(scriptName, "home");
      cur += ram * (running.get(scriptName)?.length || 0)
    })

    ns.printf("Used %s < %s / %s", ns.formatRam(cur), ns.formatRam(thresh), ns.formatRam(max))
    if (cur > thresh) {
      await ns.sleep(100);
      continue;
    }

    // batch

    const grow_time = ns.getGrowTime(targetName)
    const hack_time = ns.getHackTime(targetName)
    const weak_time = ns.getWeakenTime(targetName)

    const batchtime = Math.max(
      grow_time, hack_time, weak_time,
    );

    const grow_sleep = batchtime - grow_time;
    const hack_sleep = batchtime - hack_time + 1;
    const weak_sleep = batchtime - weak_time + 2;

    const grow_script: Script = {
      filename: GROW,
      opts: {
        args: [targetName, grow_sleep]
      }
    }
    const hack_script: Script = {
      filename: HACK,
      opts: {
        args: [targetName, hack_sleep]
      }
    }
    const weak_script: Script = {
      filename: WEAK,
      opts: {
        args: [targetName, weak_sleep]
      }
    }

    const res: Script[] = runScriptsOnFreeServer(ns, [grow_script, hack_script, weak_script]);

    res.forEach(script => {
      running.set(
        script.filename,
        (running.get(script.filename) ?? []).concat(script)
      )
    })

    await ns.sleep(TICK_INVERTALL);
  }
}


