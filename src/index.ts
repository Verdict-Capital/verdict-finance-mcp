#!/usr/bin/env node
// verdict-finance-mcp — Verdict ratings for AI agents, over MCP.
// Local stdio transport. Wraps the live Verdict API keylessly by default;
// set VERDICT_API_KEY to authenticate and unlock the tier-gated depth reads.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { HttpVerdictClient } from "./client.js";
import { getRating, getRatingInput, getRatingMeta } from "./tools/get.js";
import { searchRatings, searchRatingsInput, searchRatingsMeta } from "./tools/search.js";
import { listRatings, listRatingsInput, listRatingsMeta } from "./tools/list.js";
import { quantumReadiness, quantumReadinessInput, quantumReadinessMeta } from "./tools/quantum.js";
import { getRecentIncidents, recentIncidentsInput, recentIncidentsMeta } from "./tools/incidents.js";
import { getMethodology, getMethodologyInput, getMethodologyMeta } from "./tools/methodology.js";
import { getRatingBreakdown, getRatingBreakdownInput, getRatingBreakdownMeta } from "./tools/breakdown.js";
import { requestCoverage, requestCoverageInput, requestCoverageMeta } from "./tools/coverage.js";
import {
  SERVER_DESCRIPTION,
  SERVER_INSTRUCTIONS,
  SERVER_TITLE,
  SITE_URL,
} from "./identity.js";

// Three-field release rule: this constant, package.json, and server.json move
// together.
const VERSION = "0.4.0";

async function main(): Promise<void> {
  const client = new HttpVerdictClient();
  const server = new McpServer(
    {
      name: "verdict-finance-mcp",
      title: SERVER_TITLE,
      version: VERSION,
      description: SERVER_DESCRIPTION,
      websiteUrl: SITE_URL,
    },
    { instructions: SERVER_INSTRUCTIONS },
  );

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

  server.registerTool(
    quantumReadinessMeta.name,
    {
      title: quantumReadinessMeta.title,
      description: quantumReadinessMeta.description,
      inputSchema: quantumReadinessInput,
    },
    (args) => quantumReadiness(client, args),
  );

  server.registerTool(
    recentIncidentsMeta.name,
    {
      title: recentIncidentsMeta.title,
      description: recentIncidentsMeta.description,
      inputSchema: recentIncidentsInput,
    },
    (args) => getRecentIncidents(client, args),
  );

  server.registerTool(
    getRatingBreakdownMeta.name,
    {
      title: getRatingBreakdownMeta.title,
      description: getRatingBreakdownMeta.description,
      inputSchema: getRatingBreakdownInput,
    },
    (args) => getRatingBreakdown(client, args),
  );

  server.registerTool(
    getMethodologyMeta.name,
    {
      title: getMethodologyMeta.title,
      description: getMethodologyMeta.description,
      inputSchema: getMethodologyInput,
    },
    () => getMethodology(client),
  );

  server.registerTool(
    requestCoverageMeta.name,
    {
      title: requestCoverageMeta.title,
      description: requestCoverageMeta.description,
      inputSchema: requestCoverageInput,
    },
    (args) => requestCoverage(client, args),
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
