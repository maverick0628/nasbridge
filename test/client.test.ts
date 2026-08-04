import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { WebSocketServer } from "ws";
import { TrueNASClient } from "../src/client.ts";

function createMockServer(port: number): { wss: WebSocketServer; calls: Array<{ method: string; params: unknown[] }> } {
  const calls: Array<{ method: string; params: unknown[] }> = [];
  const wss = new WebSocketServer({ port });

  wss.on("connection", (ws) => {
    ws.on("message", (raw) => {
      const msg = JSON.parse(raw.toString());

      if (msg.method === "auth.login_with_api_key") {
        ws.send(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: true }));
        return;
      }

      if (msg.method === "core.ping") {
        ws.send(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: "pong" }));
        return;
      }

      calls.push({ method: msg.method, params: msg.params });

      if (msg.method === "pool.query") {
        ws.send(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: [{ id: 1, name: "tank" }] }));
      } else if (msg.method === "pool.get_instance") {
        ws.send(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: { id: 1, name: "tank" } }));
      } else if (msg.method === "system.info") {
        ws.send(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: { version: "TrueNAS-26.0" } }));
      } else if (msg.method === "smb.config") {
        ws.send(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: { netbiosname: "NAS" } }));
      } else {
        ws.send(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: "ok" }));
      }
    });
  });

  return { wss, calls };
}

describe("TrueNASClient (WebSocket)", () => {
  let server: { wss: WebSocketServer; calls: Array<{ method: string; params: unknown[] }> };
  let client: TrueNASClient;
  const PORT = 19876;

  beforeEach(async () => {
    server = createMockServer(PORT);
    client = new TrueNASClient({
      baseUrl: `ws://127.0.0.1:${PORT}`,
      apiKey: "1-testkey123",
    });
    await client.connect();
  });

  afterEach(async () => {
    client.close();
    await new Promise<void>((resolve) => server.wss.close(() => resolve()));
  });

  it("authenticates on connect", async () => {
    assert.ok(client.isConnected());
  });

  it("GET /pool -> pool.query", async () => {
    const result = await client.get("/pool");
    assert.deepEqual(result, [{ id: 1, name: "tank" }]);
    assert.equal(server.calls[0].method, "pool.query");
  });

  it("GET /pool/id/1 -> pool.get_instance", async () => {
    const result = await client.get("/pool/id/1");
    assert.deepEqual(result, { id: 1, name: "tank" });
    assert.equal(server.calls[0].method, "pool.get_instance");
    assert.deepEqual(server.calls[0].params, [1]);
  });

  it("GET /system/info -> system.info", async () => {
    const result = await client.get("/system/info");
    assert.deepEqual(result, { version: "TrueNAS-26.0" });
    assert.equal(server.calls[0].method, "system.info");
  });

  it("GET /smb -> smb.config", async () => {
    const result = await client.get("/smb");
    assert.deepEqual(result, { netbiosname: "NAS" });
    assert.equal(server.calls[0].method, "smb.config");
  });

  it("POST /pool (body) -> pool.create", async () => {
    const body = { name: "newpool" };
    await client.post("/pool", body);
    assert.equal(server.calls[0].method, "pool.create");
    assert.deepEqual(server.calls[0].params, [body]);
  });

  it("PUT /pool/id/1 (body) -> pool.update", async () => {
    const body = { autotrim: true };
    await client.put("/pool/id/1", body);
    assert.equal(server.calls[0].method, "pool.update");
    assert.deepEqual(server.calls[0].params, [1, body]);
  });

  it("ping returns true", async () => {
    const ok = await client.ping();
    assert.ok(ok);
  });
});
