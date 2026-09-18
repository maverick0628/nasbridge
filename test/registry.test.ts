import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { categorize, ToolRegistry } from "../src/registry.ts";

it("passes project TypeScript checking with registry.ts included", () => {
  const result = spawnSync(process.execPath, [
    fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)),
    "--noEmit",
  ], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    encoding: "utf8",
  });

  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

describe("categorize", () => {
  const cases = [
    ["system", ["system_info", "service_list", "mail_config", "api_key_list"]],
    ["storage", ["pool_list", "dataset_create", "snapshot_list"]],
    ["sharing", ["smb_list", "nfs_list", "iscsi_targets"]],
    ["network", ["network_interfaces"]],
    ["account", ["user_list", "group_list", "privilege_list"]],
    ["disk", ["disk_list"]],
    ["vm", ["vm_list"]],
    ["app", ["app_list", "docker_config"]],
    ["update", ["update_check", "bootenv_list", "boot_get_state"]],
    ["certificate", ["certificate_list", "acme_list"]],
    ["alert", ["alert_list", "alertservice_list"]],
    ["data_protection", ["replication_list", "cloudsync_list", "cloud_backup_list", "cronjob_list", "rsync_task_list", "initshutdown_list", "keychaincredential_list"]],
    ["filesystem", ["filesystem_stat"]],
    ["reporting", ["reporting_graphs"]],
    ["directory", ["directory_config", "kerberos_list"]],
    ["service_config", ["ssh_config", "ftp_config", "snmp_config", "ups_config", "tunable_list"]],
    ["audit", ["audit_query"]],
    ["api", ["truenas_api_call"]],
  ] as const;

  for (const [category, names] of cases) {
    for (const name of names) {
      it(`routes ${name} to ${category}`, () => {
        assert.equal(categorize(name), category);
      });
    }
  }

  it("falls back to system for names without a known prefix", () => {
    for (const name of ["unknown_action", "", "pool", "prefix_pool_list", "POOL_list", "truenas_api_call_extra"]) {
      assert.equal(categorize(name), "system");
    }
  });
});

describe("ToolRegistry.execute", () => {
  it("returns an unknown-action error listing only actions in the requested category", async () => {
    const registry = new ToolRegistry();
    const handler = () => assert.fail("must not dispatch an unknown action");
    registry.tool("pool_list", "List pools", {}, handler);
    registry.tool("snapshot_list", "List snapshots", {}, handler);
    registry.tool("system_info", "System info", {}, handler);

    assert.deepEqual(await registry.execute("storage", "pool_missing", {}), {
      error: 'Unknown action "pool_missing" in category "storage". Available: pool_list, snapshot_list',
    });
    assert.deepEqual(await registry.execute("unknown", "pool_missing", {}), {
      error: 'Unknown action "pool_missing" in category "unknown". Available: ',
    });
  });

  it("rejects a known action in the wrong category without calling its handler", async () => {
    const registry = new ToolRegistry();
    registry.tool("pool_list", "List pools", {}, () => assert.fail("must not dispatch across categories"));

    assert.deepEqual(await registry.execute("system", "pool_list", {}), {
      error: 'Action "pool_list" belongs to category "storage", not "system". Use category "storage" instead.',
    });
  });

  it("passes params to the matching handler once and returns its resolved result", async () => {
    const registry = new ToolRegistry();
    const params = { name: "tank", options: { recursive: true } };
    const result = { content: [{ type: "text", text: "created" }] };
    let calls = 0;
    registry.tool("dataset_create", "Create dataset", {}, async (received) => {
      calls++;
      assert.strictEqual(received, params);
      return result;
    });
    registry.tool("system_info", "System info", {}, () => assert.fail("wrong handler"));

    assert.strictEqual(await registry.execute("storage", "dataset_create", params), result);
    assert.equal(calls, 1);
  });
});

describe("ToolRegistry discovery", () => {
  it("lists category counts and omits categories without registered tools", () => {
    const registry = new ToolRegistry();
    registry.tool("pool_list", "List pools", {}, () => null);
    registry.tool("dataset_list", "List datasets", {}, () => null);
    registry.tool("system_info", "System info", {}, () => null);

    const listing = registry.listCategories();
    assert.match(listing, /3 tools across 2 categories/);
    assert.match(listing, /storage \(2 actions\)/);
    assert.match(listing, /system \(1 actions\)/);
    assert.doesNotMatch(listing, /sharing \(/);
  });

  it("lists required and optional Zod parameters with descriptions", () => {
    const registry = new ToolRegistry();
    registry.tool("dataset_create", "Create dataset", {
      name: z.string().describe("Dataset name"),
      recursive: z.boolean().optional().describe("Include children"),
    }, () => null);

    const listing = registry.listActions("storage");
    assert.match(listing, /dataset_create — Create dataset/);
    assert.match(listing, /Required: name \(Dataset name\)/);
    assert.match(listing, /Optional: recursive \(Include children\)/);
    assert.equal(registry.listActions("disk"), 'No actions found in category "disk".');
    assert.match(registry.listActions("unknown"), /^Unknown category "unknown"\. Available categories: system, storage,/);
    for (const inherited of ["constructor", "toString", "__proto__"]) {
      assert.match(registry.listActions(inherited), new RegExp(`^Unknown category "${inherited}"`));
    }
  });
});
