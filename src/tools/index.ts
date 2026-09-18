// @ts-nocheck
import { ToolRegistry } from "../registry.ts";
import { register as registerSystem } from "./system.ts";
import { register as registerStorage } from "./storage.ts";
import { register as registerSharing } from "./sharing.ts";
import { register as registerNetwork } from "./network.ts";
import { register as registerVm } from "./vm.ts";
import { register as registerAlert } from "./alert.ts";
import { register as registerReplication } from "./replication.ts";
import { register as registerFilesystem } from "./filesystem.ts";
export function buildRegistry(client) {
    const registry = new ToolRegistry();
    // All register() functions call registry.tool() which captures definitions
    registerSystem(registry, client);
    registerStorage(registry, client);
    registerSharing(registry, client);
    registerNetwork(registry, client);
    registerVm(registry, client);
    registerAlert(registry, client);
    registerReplication(registry, client);
    registerFilesystem(registry, client);
    return registry;
}
//# sourceMappingURL=index.js.map