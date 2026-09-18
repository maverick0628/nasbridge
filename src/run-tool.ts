import { redactText, redactToolResult, type ToolResult } from "./redact.ts";

export interface ToolExecutor {
  execute(category: string, action: string, params: Record<string, unknown>): unknown;
}

function isToolResult(value: unknown): value is ToolResult {
  return value !== null && typeof value === "object" && "content" in value && Array.isArray(value.content);
}

/**
 * Run one action and shape the MCP result. Every path out, including errors, is redacted,
 * so a new handler is covered without doing anything.
 */
export async function runTool(
  registry: ToolExecutor,
  category: string,
  action: string,
  params: Record<string, unknown>,
): Promise<ToolResult> {
  try {
    const result = await registry.execute(category, action, params);
    if (isToolResult(result)) return redactToolResult(result);
    const text = typeof result === "string" ? result : JSON.stringify(result, null, 2);
    return redactToolResult({ content: [{ type: "text", text }] });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { content: [{ type: "text", text: `Error: ${redactText(message)}` }], isError: true };
  }
}
