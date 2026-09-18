// @ts-nocheck
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { TrueNASClient } from "./client.ts";
import { buildRegistry } from "./tools/index.ts";
import { registerResources } from "./resources.ts";
import { redactingResourceServer } from "./redact.ts";
import { runTool } from "./run-tool.ts";
export function createServer(config) {
    const client = new TrueNASClient({
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        verifySsl: config.verifySsl,
    });
    const registry = buildRegistry(client);
    const actionCount = registry.tools.size;
    const categories = registry.categoryNames().join(", ");
    const server = new McpServer({
        name: "nasbridge",
        version: "1.0.0",
        description: `MCP server for TrueNAS — ${actionCount} actions behind a single hierarchical tool`,
    });
    server.tool("truenas", `Manage your TrueNAS system. ${actionCount} actions organized in categories.

Usage:
  - No args or category="help" → list all categories
  - category only → list available actions in that category with parameters
  - category + action → execute (pass action-specific params in 'params')

Categories: ${categories}

Secret values in responses (keys, passwords, tokens, private keys, password hashes) are replaced with "[redacted]" and cannot be read through this tool.`, {
        category: z
            .string()
            .optional()
            .describe(`Category name: ${categories}`),
        action: z
            .string()
            .optional()
            .describe("Action name within the category (e.g. 'pool_list', 'dataset_create'). Omit to discover available actions."),
        params: z
            .record(z.string(), z.unknown())
            .optional()
            .describe("Action-specific parameters as key-value pairs. Discover required params by calling with just category."),
    }, async ({ category, action, params }) => {
        if (!category || category === "help") {
            return {
                content: [{ type: "text", text: registry.listCategories() }],
            };
        }
        if (!action) {
            return {
                content: [{ type: "text", text: registry.listActions(category) }],
            };
        }
        return runTool(registry, category, action, params || {});
    });
    registerResources(redactingResourceServer(server), client);
    return server;
}
export async function startStdio(config) {
    const server = createServer(config);
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
