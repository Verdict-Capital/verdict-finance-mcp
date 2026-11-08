// Tool-result helpers. EVERY tool handler returns one of these — it must never
// throw, because a thrown error crashes the MCP client session.

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { VerdictError } from "./client.js";
import { KEYS_URL } from "./identity.js";

// The SDK's tool-result type (has an index signature we must satisfy).
export type ToolResult = CallToolResult;

export function textResult(text: string): ToolResult {
  return { content: [{ type: "text", text }] };
}

export function errorResult(text: string): ToolResult {
  return { content: [{ type: "text", text }], isError: true };
}

/** Map any thrown value to friendly, non-crashing text (per the spec's copy). */
export function friendlyError(err: unknown): string {
  if (err instanceof VerdictError) {
    switch (err.kind) {
      case "rate_limit":
        return "Verdict's rate limit was reached; try again shortly.";
      case "network":
      case "server":
        return "Couldn't reach Verdict right now; try again.";
      case "not_found":
        return "Not found.";
      case "unauthorized":
        return `Verdict did not accept the API key in VERDICT_API_KEY. Check the key, or make a new one, at ${KEYS_URL}.`;
      default:
        return "Something went wrong talking to Verdict; try again.";
    }
  }
  return "Something went wrong; try again.";
}
