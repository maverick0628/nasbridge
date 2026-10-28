import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/index.ts";
import { buildRegistry } from "../src/tools/index.ts";

describe("Zod 4 compatibility", () => {
  it("converts every registered action schema and preserves discovery", () => {
    const registry = buildRegistry({});
    assert.ok(registry.tools.size > 0);
    for (const tool of registry.tools.values()) {
      const schema = z.object(tool.schema);
      const json = z.toJSONSchema(schema);
      assert.equal(json.type, "object", tool.name);
      assert.deepEqual(Object.keys(json.properties ?? {}), Object.keys(tool.schema), tool.name);
      assert.ok(registry.listActions(tool.category).includes(tool.name));
    }
  });

  it("preserves required, optional and default action parameters", () => {
    const registry = buildRegistry({});
    const reboot = z.object(registry.tools.get("system_reboot")!.schema);
    assert.equal(reboot.parse({ confirm: true }).delay, 0);
    assert.equal(reboot.safeParse({ confirm: true, delay: "later" }).success, false);
    const pool = z.object(registry.tools.get("pool_get")!.schema);
    assert.deepEqual(pool.parse({ id: 1 }), { id: 1 });
    assert.equal(pool.safeParse({}).success, false);
    assert.equal(pool.safeParse({ id: "1" }).success, false);
  });

  it("dispatches parsed valid parameters to a mocked client", async () => {
    const calls: string[] = [];
    const registry = buildRegistry({ get: async (path: string) => {
      calls.push(path);
      return { id: 7 };
    } });
    const params = z.object(registry.tools.get("pool_get")!.schema).parse({ id: 7 });
    const result = await registry.execute("storage", "pool_get", params) as { content: { text: string }[] };
    assert.deepEqual(calls, ["/pool/id/7"]);
    assert.deepEqual(JSON.parse(result.content[0].text), { id: 7 });
  });

  it("exports MCP input schemas, accepts omitted options and rejects invalid inputs", async () => {
    const server = createServer({ baseUrl: "https://nas.invalid", apiKey: "unused", verifySsl: false });
    const client = new Client({ name: "zod-compat-test", version: "0.0.0" });
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    try {
      await server.connect(serverSide);
      await client.connect(clientSide);
      const { tools } = await client.listTools();
      const tool = tools.find((entry) => entry.name === "truenas")!;
      assert.equal(tool.inputSchema.type, "object");
      assert.deepEqual(Object.keys(tool.inputSchema.properties ?? {}), ["category", "action", "params"]);
      assert.deepEqual(tool.inputSchema.required ?? [], []);
      const help = await client.callTool({ name: "truenas", arguments: {} });
      assert.notEqual(help.isError, true);
      for (const args of [{ category: 123 }, { params: [] }, { action: false }]) {
        const result = await client.callTool({ name: "truenas", arguments: args });
        assert.equal(result.isError, true, JSON.stringify(args));
      }
    } finally {
      await client.close();
      await server.close();
    }
  });
});
