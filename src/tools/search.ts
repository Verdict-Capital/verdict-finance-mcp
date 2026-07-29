import { z } from "zod";
import { ENTITY_TYPES, type EntityType } from "../entities.js";
import type { VerdictClient } from "../client.js";
import { attribution, byGradeDesc, formatItem, type RatingItem } from "../format.js";
import { enrichWithRatings } from "../enrich.js";
import { textResult, errorResult, friendlyError, type ToolResult } from "../respond.js";
import { entityTypeSchema } from "../schema.js";

const PER_TYPE_LIMIT = 10;
const MERGED_CAP = 15;

export const searchRatingsInput = {
  query: z.string().min(1).describe("Name or keyword to search for, e.g. 'aave' or 'chainlink'."),
  entity_type: entityTypeSchema
    .optional()
    .describe("Optional: restrict to one entity type. Omit to search all 7 types at once."),
} as const;

export const searchRatingsMeta = {
  name: "search_ratings",
  title: "Search Verdict ratings",
  description:
    "Search Verdict's DeFi ratings by name or keyword across all 7 entity types (protocol, chain, token, oracle, vault, organisation, bridge). Pass entity_type to narrow the search. Returns matching entities with their letter grade + composite score. Example: search_ratings({ query: 'aave' }).",
};

async function searchOne(
  client: VerdictClient,
  entity_type: EntityType,
  query: string,
): Promise<RatingItem[]> {
  const entities = await client.listEntities(entity_type, { search: query, limit: PER_TYPE_LIMIT });
  return enrichWithRatings(client, entity_type, entities);
}

export async function searchRatings(
  client: VerdictClient,
  args: { query: string; entity_type?: EntityType },
): Promise<ToolResult> {
  const { query, entity_type } = args;

  let items: RatingItem[];
  if (entity_type) {
    try {
      items = await searchOne(client, entity_type, query);
    } catch (err) {
      return errorResult(friendlyError(err));
    }
  } else {
    const settled = await Promise.allSettled(
      ENTITY_TYPES.map((t) => searchOne(client, t, query)),
    );
    const ok = settled.filter((s) => s.status === "fulfilled");
    if (ok.length === 0) {
      const firstReason = settled.find((s) => s.status === "rejected");
      return errorResult(
        friendlyError(firstReason && "reason" in firstReason ? firstReason.reason : undefined),
      );
    }
    items = ok.flatMap((s) => (s as PromiseFulfilledResult<RatingItem[]>).value);
  }

  if (items.length === 0) {
    return textResult(`No Verdict ratings found for "${query}".\n\n${attribution()}`);
  }

  items.sort(byGradeDesc);
  const shown = items.slice(0, MERGED_CAP);
  const lines = shown.map((it) => formatItem(it)).join("\n");
  return textResult(`${lines}\n\n${attribution()}`);
}
