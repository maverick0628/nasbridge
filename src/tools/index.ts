// @ts-nocheck
import { ToolRegistry } from "../registry.js";
import { register as registerSystem } from "./system.js";
import { register as registerStorage } from "./storage.js";
import { register as registerSharing } from "./sharing.js";
import { register as registerNetwork } from "./network.js";
import { register as registerVm } from "./vm.js";
import { register as registerAlert } from "./alert.js";
import { register as registerReplication } from "./replication.js";
import { register as registerFilesystem } from "./filesystem.js";
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