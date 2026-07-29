import { z } from "zod";
import type { EntityType } from "../entities.js";
import type { VerdictClient } from "../client.js";
import { attribution, byGradeDesc, formatItem } from "../format.js";
import { enrichWithRatings } from "../enrich.js";
import { textResult, errorResult, friendlyError, type ToolResult } from "../respond.js";
import { entityTypeSchema } from "../schema.js";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 50;

export const listRatingsInput = {
  entity_type: entityTypeSchema.describe("The kind of entity to browse: protocol, chain, token, oracle, vault, organisation, or bridge."),
  category: z.string().optional().describe("Optional category filter, lowercase, e.g. 'lending'."),
  chain: z.string().optional().describe("Optional chain filter by chain slug, e.g. 'ethereum' or 'base'."),
  limit: z.number().int().positive().max(MAX_LIMIT).optional().describe(`Max results (default ${DEFAULT_LIMIT}, cap ${MAX_LIMIT}).`),
} as const;

export const listRatingsMeta = {
  name: "list_ratings",
  title: "List / browse Verdict ratings",
  description:
    "Browse Verdict's DeFi ratings for one entity type, optionally filtered by category or chain. Returns entities with their letter grade + composite score, best-rated first. Example: list_ratings({ entity_type: 'protocol', category: 'lending' }).",
};

export async function listRatings(
  client: VerdictClient,
  args: { entity_type: EntityType; category?: string; chain?: string; limit?: number },
): Promise<ToolResult> {
  const { entity_type, category, chain } = args;
  const limit = Math.min(args.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

  let items;
  try {
    const entities = await client.listEntities(entity_type, { category, chain, limit });
    items = await enrichWithRatings(client, entity_type, entities);
  } catch (err) {
    return errorResult(friendlyError(err));
  }

  if (items.length === 0) {
    const filters = [category && `category '${category}'`, chain && `chain '${chain}'`]
      .filter(Boolean)
      .join(", ");
    const suffix = filters ? ` matching ${filters}` : "";
    return textResult(`No ${entity_type} ratings found${suffix}.\n\n${attribution()}`);
  }

  items.sort(byGradeDesc);
  const lines = items.map((it) => formatItem(it)).join("\n");
  return textResult(`${lines}\n\n${attribution()}`);
}
