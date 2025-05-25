import { NS } from "@ns";
import { allocatedServers, AllocationBuffer, getAllocationServer, getExecutorAllocators } from "./util/network2";
import { Script } from "./util/scripts";

export async function main(ns: NS): Promise<void> {
  ns.disableLog("ALL")
  ns.clearLog();
  ns.ui.openTail();

  allocatedServers.clear()

  const buffer = new AllocationBuffer(ns, 50);

  const script: Script = { filename: "brain/weak.js", opts: { args: ["n00dles"] } };
  buffer.allocate(script);
  buffer.allocate(script);
  buffer.allocate(script);
  const script2: Script = { filename: "brain/weak.js", opts: { args: ["foodnstuff"] } };
  buffer.allocate(script2);
  buffer.allocate(script2);
  buffer.allocate(script2);
  buffer.allocate(script2);
  buffer.allocate(script2);

  for (const [key, value] of buffer.executors) {
    ns.print(" - ", key, " -> ", value)
  }

  buffer.simplify()

  ns.print("====")
  for (const [key, value] of buffer.executors) {
    ns.print(" - ", key, " -> ", value)
  }

  buffer.execute();
}
