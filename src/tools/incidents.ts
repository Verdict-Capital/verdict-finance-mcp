import { z } from "zod";
import type { Incident, IncidentTier, VerdictClient } from "../client.js";
import { errorResult, friendlyError, textResult, type ToolResult } from "../respond.js";

const MAX_LIMIT = 200;
const FEED_ATTRIB =
  "Confirmed hack feed by Verdict - https://www.verdict.finance/products/ratings";

export const recentIncidentsInput = {
  since: z
    .string()
    .optional()
    .describe(
      "Optional ISO datetime (e.g. '2026-08-01T00:00:00Z'). Returns only incidents detected after it. Use the timestamp of the newest incident you have already seen to poll for what is new.",
    ),
  slug: z
    .string()
    .optional()
    .describe("Optional Verdict protocol slug (e.g. 'aave-v4'). Exact match, not a search."),
  min_status: z
    .enum(["rumored", "corroborated", "confirmed"])
    .optional()
    .describe(
      "Optional lowest confidence tier to return. Omit for the default of confirmed, which is the same set this tool has always returned. Pass 'corroborated' to also see multi-source leads that have not yet reached confirmation; expect the same incident_id to reappear at a higher tier as a lead escalates, so key on incident_id rather than assuming each id appears once.",
    ),
  limit: z
    .number()
    .int()
    .positive()
    .max(MAX_LIMIT)
    .optional()
    .describe(`Optional maximum number of incidents to return (default 25, cap ${MAX_LIMIT}).`),
} as const;

export const recentIncidentsMeta = {
  name: "get_recent_incidents",
  title: "Recent hack incidents",
  description:
    "Hack incidents across DeFi, newest first. Every incident is corroborated by more than one public hack-reporting source before it appears, so the feed lags the first rumour of an exploit by design and is not a real-time exploit alarm. Incidents carry a confidence tier in `status`: corroborated, then confirmed. By default only confirmed incidents are returned, which is exactly the set this tool has always returned; pass min_status: 'corroborated' to also see multi-source leads that have not yet reached confirmation. Poll with `since` set to the newest detected_at you have already seen. An incident that escalates keeps its incident_id and refreshes its detected_at, so the same id reappears at the top of a `since` poll at its new tier: key on incident_id and expect to see an incident more than once as it climbs. A tier never goes down in the feed. Covers protocols, including ones Verdict does not rate: `matched_protocol` says whether the incident matched a rated protocol, and matching re-runs when an incident escalates and its payload improves, so matched_protocol reads as of the incident's current tier; it is still never retroactive when Verdict's own coverage grows. An incident is a signal to look, never an automatic downgrade: a matched entity may be flagged under review, but re-rating is always a human decision, so do not infer a grade change from an incident appearing here. Examples: get_recent_incidents({ limit: 10 }), get_recent_incidents({ since: '2026-08-01T00:00:00Z' }), get_recent_incidents({ min_status: 'corroborated' }).",
};

function usd(value: number | null): string {
  if (value == null) return "loss unknown";
  if (value >= 1_000_000) return `~$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `~$${Math.round(value / 1_000)}k`;
  return `~$${value}`;
}

function day(iso: string): string {
  return iso.slice(0, 10);
}

function renderIncident(i: Incident): string {
  // first_seen_at is when the hack was first reported; detected_at is when the
  // feed last moved the incident's tier, which can be much later and is shared
  // by a whole batch. The report date is what tells an agent when this actually
  // happened, so it is the one on the line. detected_at stays the polling
  // cursor below.
  //
  // Anything below confirmed is tagged, because these lines get summarised and
  // an unconfirmed lead read aloud as a confirmed hack is the failure that
  // matters here.
  const tag = i.status === "confirmed" ? "" : `[${i.status} - unconfirmed lead] `;
  const bits = [
    `${tag}${i.protocol_name} - first reported ${day(i.first_seen_at)}`,
    i.exploit_class ?? "class unknown",
    usd(i.loss_estimate_usd),
  ];
  if (i.chain) bits.push(i.chain);
  bits.push(`${i.source_count} sources`);
  bits.push(
    i.matched_protocol && i.slug
      ? `rated by Verdict as ${i.slug}`
      : "not a Verdict-rated protocol at detection",
  );
  if (i.resolved_at) bits.push(`resolved ${day(i.resolved_at)}`);
  return bits.join(" · ");
}

export async function getRecentIncidents(
  client: VerdictClient,
  args: { since?: string; slug?: string; min_status?: IncidentTier; limit?: number },
): Promise<ToolResult> {
  let page: { items: Incident[]; total: number };
  try {
    page = await client.listIncidents({
      since: args.since,
      slug: args.slug,
      min_status: args.min_status,
      limit: args.limit,
    });
  } catch (err) {
    return errorResult(friendlyError(err));
  }

  // Only call the result "confirmed" when confirmed is all that was asked for.
  // Omitting min_status inherits the server default, which is confirmed.
  const askedForLeads =
    args.min_status !== undefined && args.min_status !== "confirmed";
  const noun = askedForLeads ? "hack incidents" : "confirmed hack incidents";

  if (page.items.length === 0) {
    const scope = args.slug ? ` for ${args.slug}` : "";
    const window = args.since ? ` since ${args.since}` : "";
    return textResult(`No ${noun}${scope}${window}. ${FEED_ATTRIB}`);
  }

  const header =
    `${page.items.length} of ${page.total} ${noun}, newest first:`;
  const lines = page.items.map(renderIncident);
  const newest = page.items[0]?.detected_at;
  const footer = [
    newest ? `Poll for new ones with since='${newest}'.` : null,
    "An incident is a signal to look, not a grade change: re-rating is always a human decision.",
    FEED_ATTRIB,
  ].filter((s): s is string => s !== null);

  return textResult([header, ...lines, "", ...footer].join("\n"));
}
