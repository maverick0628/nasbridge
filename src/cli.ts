#!/usr/bin/env node
import { startStdio } from "./index.js";
import { toWebSocketUrl } from "./client.js";

const baseUrl = process.env.TRUENAS_URL || process.env.TRUENAS_HOST;
const apiKey = process.env.TRUENAS_API_KEY;

if (!baseUrl) {
  const exampleUrl = "https://truenas.local";
  console.error(
    "Error: TRUENAS_URL environment variable is required.\n" +
    "Set it to your TrueNAS instance URL, e.g.:\n" +
    `  export TRUENAS_URL=${exampleUrl}\n` +
    "  export TRUENAS_API_KEY=1-abc123...\n" +
    "\n" +
    `The client connects to ${toWebSocketUrl(exampleUrl)} (http:// and https:// become wss://).\n` +
    "Do not use ws://. TrueNAS revokes any API key it sees over an insecure connection.\n"
  );
  process.exit(1);
}

if (!apiKey) {
  console.error(
    "Error: TRUENAS_API_KEY environment variable is required.\n" +
    "Generate an API key in TrueNAS UI: Credentials → API Keys → Add\n"
  );
  process.exit(1);
}

const verifySsl = process.env.TRUENAS_VERIFY_SSL !== "false";

startStdio({ baseUrl, apiKey, verifySsl }).catch((err) => {
  console.error("Failed to start TrueNAS WS-MCP server:", err);
  process.exit(1);
});
