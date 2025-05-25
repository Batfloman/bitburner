import { NS } from "@ns";

export async function main(ns: NS): Promise<void> {
  const targetName = ns.args[0]?.toString() || "n00dles";
  const delay = ns.args[1] ?? 0;

  await ns.sleep(delay);
  await ns.hack(targetName);
}
