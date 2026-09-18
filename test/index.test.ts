import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/index.ts";

type TextResult = { content: { type: string; text: string }[] };

function listAfter(text: string, label: string): string[] {
  const line = text.split("\n").find((l) => l.startsWith(label));
  assert.ok(line, `no line starting with ${JSON.stringify(label)} in:\n${text}`);
  return line.slice(label.length).split(",").map((s) => s.trim()).filter(Boolean);
}

describe("truenas tool description", () => {
  let client: Client;
  let description: string;
  let categoryParam: string;
  let help: string;
  let declared: string[];
  let populated: Map<string, number>;

  const call = async (args: Record<string, unknown>): Promise<string> => {
    const result = await client.callTool({ name: "truenas", arguments: args }) as TextResult;
    return result.content.map((c) => c.text).join("\n");
  };

  before(async () => {
    // The client only opens its WebSocket on the first request, and discovery never makes one.
    const server = createServer({ baseUrl: "https://nas.invalid", apiKey: "unused", verifySsl: false });
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    await server.connect(serverSide);
    client = new Client({ name: "test", version: "0.0.0" });
    await client.connect(clientSide);

    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === "truenas");
    assert.ok(tool, "truenas tool is registered");
    description = tool.description ?? "";
    categoryParam = String((tool.inputSchema.properties?.category as { description?: string })?.description ?? "");

    help = await call({ category: "help" });
    declared = listAfter(await call({ category: "no_such_category" }), 'Unknown category "no_such_category". Available categories: ');
    populated = new Map(
      [...help.matchAll(/^ {2}(\w+) \((\d+) actions\)/gm)].map((m) => [m[1], Number(m[2])]),
    );
  });

  after(async () => {
    await client?.close();
  });

  it("names exactly the categories the server lists, in the same order", () => {
    assert.ok(populated.size > 0, `help listed no categories:\n${help}`);
    assert.deepEqual(listAfter(description, "Categories: "), [...populated.keys()]);
  });

  it("gives the category parameter the same list", () => {
    assert.deepEqual(listAfter(categoryParam, "Category name: "), [...populated.keys()]);
  });

  it("names no category the registry does not declare", () => {
    for (const name of listAfter(description, "Categories: ")) {
      assert.ok(declared.includes(name), `description names unknown category "${name}"`);
    }
    assert.ok(!listAfter(description, "Categories: ").includes("replication"));
  });

  it("names only categories that resolve to a list of actions", async () => {
    for (const name of listAfter(description, "Categories: ")) {
      assert.match(await call({ category: name }), new RegExp(`^Category: ${name} — `));
    }
  });

  it("leaves no declared category without actions", () => {
    assert.deepEqual([...populated.keys()], declared);
  });

  it("states the number of registered actions", () => {
    const total = Number(help.match(/— (\d+) tools across/)?.[1]);
    assert.equal(total, [...populated.values()].reduce((a, b) => a + b, 0));
    assert.match(description, new RegExp(`^Manage your TrueNAS system\\. ${total} actions organized in categories\\.`));
  });
});
