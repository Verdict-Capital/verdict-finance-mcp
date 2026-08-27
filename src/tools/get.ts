import { z } from "zod";
import type { EntityType } from "../entities.js";
import { VerdictError, type VerdictClient } from "../client.js";
import { attribution, deepLink, detailLines, formatItem, quantumReadinessLine, toRatingItem } from "../format.js";
import { textResult, errorResult, friendlyError, type ToolResult } from "../respond.js";
import { entityTypeSchema } from "../schema.js";

export const getRatingInput = {
  entity_type: entityTypeSchema.describe("The kind of entity: protocol, chain, token, oracle, vault, organisation, or bridge."),
  identifier: z.string().min(1).describe("The entity's slug (e.g. 'aave-v4' or 'ethereum') or UUID."),
} as const;

export const getRatingMeta = {
  name: "get_rating",
  title: "Get a Verdict rating",
  description:
    "Get the Verdict rating for one DeFi entity: letter grade, composite score 0-100, and public metadata. Identify it by slug (e.g. 'aave-v4') or UUID. Keyless. For the per-domain scores behind the grade, use get_rating_breakdown. Example: get_rating({ entity_type: 'protocol', identifier: 'aave-v4' }).",
};

export async function getRating(
  client: VerdictClient,
  args: { entity_type: EntityType; identifier: string },
): Promise<ToolResult> {
  const { entity_type, identifier } = args;
  try {
    const entity = await client.getEntity(entity_type, identifier);
    const rating = await client.getLatestRating(entity_type, entity.id);
    const item = toRatingItem(entity_type, entity, rating);
    const lines = [formatItem(item, { categories: true }), ...detailLines(item)];
    if (entity_type === "chain") {
      // Companion quantum-readiness line. A quantum lookup failure must NEVER
      // break a rating response, so it is fully isolated.
      try {
        const ql = quantumReadinessLine(await client.getQuantumReadiness(entity.slug));
        if (ql) lines.push(ql);
      } catch {
        // swallow - no quantum line, rating stands
      }
    }
    const body = lines.join("\n");
    return textResult(`${body}\n\n${attribution(deepLink(entity_type, entity.slug))}`);
  } catch (err) {
    if (err instanceof VerdictError && err.kind === "not_found") {
      return textResult(
        `No Verdict rating found for "${identifier}" (${entity_type}).\n\n${attribution()}`,
      );
    }
    return errorResult(friendlyError(err));
  }
}
