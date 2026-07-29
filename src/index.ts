#!/usr/bin/env node
// verdict-finance-mcp — Verdict ratings for AI agents, over MCP.
// Local stdio transport; wraps the live anonymous Verdict API (no key needed).

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { HttpVerdictClient } from "./client.js";
import { getRating, getRatingInput, getRatingMeta } from "./tools/get.js";
import { searchRatings, searchRatingsInput, searchRatingsMeta } from "./tools/search.js";
import { listRatings, listRatingsInput, listRatingsMeta } from "./tools/list.js";

const VERSION = "0.1.0";

async function main(): Promise<void> {
  const client = new HttpVerdictClient();
  const server = new McpServer({ name: "verdict-finance-mcp", version: VERSION });

  server.registerTool(
    searchRatingsMeta.name,
    {
      title: searchRatingsMeta.title,
      description: searchRatingsMeta.description,
      inputSchema: searchRatingsInput,
    },
    (args) => searchRatings(client, args),
  );

  server.registerTool(
    getRatingMeta.name,
    {
      title: getRatingMeta.title,
      description: getRatingMeta.description,
      inputSchema: getRatingInput,
    },
    (args) => getRating(client, args),
  );

  server.registerTool(
    listRatingsMeta.name,
    {
      title: listRatingsMeta.title,
      description: listRatingsMeta.description,
      inputSchema: listRatingsInput,
    },
    (args) => listRatings(client, args),
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stderr is safe (stdout is the JSON-RPC channel); a friendly boot line.
  process.stderr.write("verdict-finance-mcp running on stdio\n");
}

main().catch((err) => {
  process.stderr.write(`verdict-finance-mcp failed to start: ${String(err)}\n`);
  process.exit(1);
});
