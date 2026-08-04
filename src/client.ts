import WebSocket from "ws";
import { restToWS } from "./path-translator.ts";

interface ClientConfig {
  baseUrl: string;
  apiKey: string;
  verifySsl?: boolean;
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class TrueNASClient {
  private ws: WebSocket | null = null;
  private readonly wsUrl: string;
  private readonly apiKey: string;
  private readonly verifySsl: boolean;
  private pending = new Map<string, PendingRequest>();
  private msgId = 0;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private connected = false;

  constructor(config: ClientConfig) {
    let base = config.baseUrl.replace(/\/+$/, "");
    if (base.startsWith("http://")) base = "wss://" + base.slice(7);
    else if (base.startsWith("https://")) base = "wss://" + base.slice(8);
    if (!base.startsWith("ws://") && !base.startsWith("wss://")) base = "wss://" + base;
    this.wsUrl = base.includes("/api/") ? base : base + "/api/current";
    this.apiKey = config.apiKey;
    this.verifySsl = config.verifySsl ?? true;
  }

  async connect(): Promise<void> {
    if (this.connected) return;

    return new Promise((resolve, reject) => {
      const opts = this.verifySsl ? {} : { rejectUnauthorized: false };
      this.ws = new WebSocket(this.wsUrl, opts);

      const timeout = setTimeout(() => {
        reject(new Error("WebSocket connection timeout"));
        this.ws?.close();
      }, 15000);

      this.ws.on("open", async () => {
        clearTimeout(timeout);
        try {
          await this.authenticate();
          this.connected = true;
          this.startPing();
          resolve();
        } catch (err) {
          reject(err);
        }
      });

      this.ws.on("message", (raw) => {
        let msg: { id?: string; result?: unknown; error?: { message?: string; data?: { reason?: string } } };
        try {
          msg = JSON.parse(raw.toString());
        } catch {
          return;
        }
        if (msg.id && this.pending.has(msg.id)) {
          const req = this.pending.get(msg.id)!;
          this.pending.delete(msg.id);
          clearTimeout(req.timer);
          if (msg.error) {
            const reason = msg.error.data?.reason || msg.error.message || "Unknown error";
            req.reject(new Error(`TrueNAS API error: ${reason}`));
          } else {
            req.resolve(msg.result);
          }
        }
      });

      this.ws.on("error", (err) => {
        clearTimeout(timeout);
        if (!this.connected) reject(err);
      });

      this.ws.on("close", () => {
        this.connected = false;
        this.stopPing();
        for (const [, req] of this.pending) {
          clearTimeout(req.timer);
          req.reject(new Error("WebSocket connection closed"));
        }
        this.pending.clear();
      });
    });
  }

  private async authenticate(): Promise<void> {
    const result = await this.call("auth.login_with_api_key", [this.apiKey]);
    if (result !== true) {
      throw new Error("Authentication failed");
    }
  }

  private nextId(): string {
    return String(++this.msgId);
  }

  private call(method: string, params: unknown[], timeoutMs = 30000): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error("WebSocket not connected"));
        return;
      }
      const id = this.nextId();
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.ws.send(JSON.stringify({ jsonrpc: "2.0", id, method, params }));
    });
  }

  private startPing(): void {
    this.pingInterval = setInterval(async () => {
      try {
        await this.call("core.ping", [], 5000);
      } catch {
        // ping failed -- connection loss detected by ws events
      }
    }, 30000);
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  close(): void {
    this.stopPing();
    this.ws?.close();
    this.connected = false;
  }

  async get(path: string, params?: Record<string, unknown>): Promise<unknown> {
    await this.ensureConnected();
    const queryParams = params
      ? Object.fromEntries(
          Object.entries(params)
            .filter(([, v]) => v !== undefined && v !== null)
            .map(([k, v]) => [k, String(v)]),
        )
      : undefined;
    const ws = restToWS("GET", path, undefined, queryParams);
    return this.call(ws.method, ws.params);
  }

  async post(path: string, body?: unknown): Promise<unknown> {
    await this.ensureConnected();
    const ws = restToWS("POST", path, body);
    return this.call(ws.method, ws.params);
  }

  async put(path: string, body?: unknown): Promise<unknown> {
    await this.ensureConnected();
    const ws = restToWS("PUT", path, body);
    return this.call(ws.method, ws.params);
  }

  async delete(path: string, body?: unknown): Promise<unknown> {
    await this.ensureConnected();
    const ws = restToWS("DELETE", path, body);
    return this.call(ws.method, ws.params);
  }

  async waitForJob(jobId: number, timeoutMs = 300000): Promise<unknown> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const jobs = await this.call("core.get_jobs", [[["id", "=", jobId]]]) as unknown[];
      const target = Array.isArray(jobs) ? jobs.find((j: unknown) => (j as { id: number }).id === jobId) : undefined;
      if (target) {
        const job = target as { state: string; error?: string; result?: unknown };
        if (job.state === "SUCCESS") return target;
        if (job.state === "FAILED") throw new Error(`Job ${jobId} failed: ${job.error}`);
        if (job.state === "ABORTED") throw new Error(`Job ${jobId} was aborted`);
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    throw new Error(`Job ${jobId} timed out after ${timeoutMs}ms`);
  }

  async ping(): Promise<boolean> {
    try {
      const result = await this.call("core.ping", [], 5000);
      return result === "pong";
    } catch {
      return false;
    }
  }

  private async ensureConnected(): Promise<void> {
    if (!this.connected) {
      await this.connect();
    }
  }

  get headers(): Record<string, string> {
    return {};
  }

  url(path: string): string {
    return `${this.wsUrl} -> ${path}`;
  }
}
