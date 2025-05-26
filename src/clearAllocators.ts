import { NS } from "@ns";
import { allocatedServers } from "./util/network2";

export async function main(ns: NS): Promise<void> {
  allocatedServers.clear();
}
