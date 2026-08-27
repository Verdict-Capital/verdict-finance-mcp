import { z } from "zod";
import type { EntityType } from "../entities.js";
import { VerdictError, type DomainBreakdown, type VerdictClient } from "../client.js";
import { attribution, deepLink } from "../format.js";
import { errorResult, friendlyError, textResult, type ToolResult } from "../respond.js";
import { entityTypeSchema } from "../schema.js";
import { PRICING_URL } from "../identity.js";

/**
 * What a keyless caller gets. It is a normal answer, never an error: an agent
 * that asked a reasonable question should be told what to do about it, not
 * handed a failure it has to interpret. Pinned by test.
 */
export const KEYLESS_ANSWER = [
  `Per-domain breakdowns need a Verdict API key: set VERDICT_API_KEY in this server's environment (keys come from the Verdict dashboard, plans at ${PRICING_URL}), then ask again.`,
  "Everything else here stays keyless. get_rating returns this entity's letter grade and composite score with no key at all, and get_methodology explains what the domains measure.",
].join("\n");

export const getRatingBreakdownInput = {
  entity_type: entityTypeSchema.describe(
    "The kind of entity: protocol, chain, token, oracle, vault, organisation, or bridge.",
  ),
  slug: z.string().min(1).describe("The entity's slug, e.g. 'aave-v4' or 'ethereum'."),
} as const;

export const getRatingBreakdownMeta = {
  name: "get_rating_breakdown",
  title: "Domain breakdown behind a rating",
  description:
    "The per-domain scores behind one entity's Verdict grade: which domains carried the rating and which dragged it down, alongside the intrinsic (pre-dependency) pair. Needs an API key: set VERDICT_API_KEY in this server's environment. Without one this tool answers with where to get a key, and get_rating still returns the headline grade and composite score keylessly. Example: get_rating_breakdown({ entity_type: 'protocol', slug: 'aave-v4' }).",
};

function headline(d: DomainBreakdown, entity_type: EntityType, slug: string): string {
  const name = d.entity?.name ?? slug;
  const grade = d.grade ?? d.letter_grade ?? null;
  const score = d.composite_score == null ? null : Math.round(d.composite_score);
  if (grade == null && score == null) {
    return `${name} (${entity_type}) - no published rating yet.`;
  }
  const badge = grade && score != null ? `${grade} (${score}/100)` : (grade ?? `(${score}/100)`);
  return `${name} (${entity_type}) - ${badge}`;
}

export async function getRatingBreakdown(
  client: VerdictClient,
  args: { entity_type: EntityType; slug: string },
): Promise<ToolResult> {
  const { entity_type, slug } = args;

  // Ask before calling: a keyless call would only earn a 401 from the route.
  if (!client.hasApiKey()) return textResult(KEYLESS_ANSWER);

  let d: DomainBreakdown;
  try {
    d = await client.getDomains(entity_type, slug);
  } catch (err) {
    if (err instanceof VerdictError && err.kind === "not_found") {
      return textResult(
        `No Verdict rating found for "${slug}" (${entity_type}).\n\n${attribution()}`,
      );
    }
    return errorResult(friendlyError(err));
  }

  const lines = [headline(d, entity_type, slug)];

  if (d.intrinsic_letter_grade || d.intrinsic_composite_score != null) {
    const score =
      d.intrinsic_composite_score == null ? null : Math.round(d.intrinsic_composite_score);
    const badge =
      d.intrinsic_letter_grade && score != null
        ? `${d.intrinsic_letter_grade} (${score}/100)`
        : (d.intrinsic_letter_grade ?? `(${score}/100)`);
    lines.push(`Intrinsic (before dependency drag): ${badge}`);
  }

  const scores = Object.entries(d.domain_scores ?? {});
  if (scores.length) {
    lines.push("", "Domain scores (0-1, each domain's share of its own maximum):");
    for (const [domain, value] of scores) lines.push(`  ${domain} - ${value}`);
  }

  const tail: string[] = [];
  if (d.largest_drag_hint) tail.push(`Dependency drag: ${d.largest_drag_hint}`);
  if (d.has_unrated_dependencies) tail.push("Note: some dependencies are not yet rated.");
  if (d.last_rated_at) tail.push(`Last rated: ${d.last_rated_at.slice(0, 10)}`);
  if (tail.length) lines.push("", ...tail);

  const link = deepLink(entity_type, d.entity?.slug ?? slug);
  return textResult(`${lines.join("\n")}\n\n${attribution(link)}`);
}
