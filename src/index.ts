// @ts-nocheck
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { TrueNASClient } from "./client.js";
import { buildRegistry } from "./tools/index.js";
import { registerResources } from "./resources.js";
export function createServer(config) {
    const client = new TrueNASClient({
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        verifySsl: config.verifySsl,
    });
    const server = new McpServer({
        name: "truenas-mcp",
        version: "1.0.0",
        description: "Comprehensive MCP server for TrueNAS SCALE — 278 tools behind a single hierarchical interface",
    });
    const registry = buildRegistry(client);
    server.tool("truenas", `Manage your TrueNAS SCALE system. 278 actions organized in categories.

Usage:
  - No args or category="help" → list all categories
  - category only → list available actions in that category with parameters
  - category + action → execute (pass action-specific params in 'params')

Categories: system, storage, sharing, network, vm, alert, replication, filesystem`, {
        category: z
            .string()
            .optional()
            .describe('Category name: system, storage, sharing, network, vm, alert, replication, filesystem'),
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
        try {
            const result = await registry.execute(category, action, params || {});
            if (result &&
                typeof result === "object" &&
                "content" in result) {
                return result;
            }
            return {
                content: [
                    {
                        type: "text",
                        text: typeof result === "string" ? result : JSON.stringify(result, null, 2),
                    },
                ],
            };
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return {
                content: [{ type: "text", text: `Error: ${message}` }],
                isError: true,
            };
        }
    });
    registerResources(server, client);
    return server;
}
export async function startStdio(config) {
    const server = createServer(config);
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
