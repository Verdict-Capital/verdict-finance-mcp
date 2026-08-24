import { z } from "zod";
import type { Incident, VerdictClient } from "../client.js";
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
  title: "Recent confirmed hack incidents",
  description:
    "Confirmed hack incidents across DeFi, newest first. Each one is corroborated by more than one public hack-reporting source before it appears, so the feed lags the first rumour of an exploit by design and is not a real-time exploit alarm. Poll with `since` set to the newest detected_at you have already seen. Covers protocols, including ones Verdict does not rate: `matched_protocol` says whether the incident matched a rated protocol, and matching happens when the incident is received, so an incident stored before its protocol was rated is never retroactively re-matched and matched_protocol reflects rating coverage as of detection rather than today. An incident is a signal to look, never an automatic downgrade: a matched entity may be flagged under review, but re-rating is always a human decision, so do not infer a grade change from an incident appearing here. Examples: get_recent_incidents({ limit: 10 }), get_recent_incidents({ since: '2026-08-01T00:00:00Z' }).",
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
  // feed CONFIRMED it, which can be much later and is shared by a whole batch.
  // The report date is what tells an agent when this actually happened, so it
  // is the one on the line. detected_at stays the polling cursor below.
  const bits = [
    `${i.protocol_name} - first reported ${day(i.first_seen_at)}`,
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
  args: { since?: string; slug?: string; limit?: number },
): Promise<ToolResult> {
  let page: { items: Incident[]; total: number };
  try {
    page = await client.listIncidents({
      since: args.since,
      slug: args.slug,
      limit: args.limit,
    });
  } catch (err) {
    return errorResult(friendlyError(err));
  }

  if (page.items.length === 0) {
    const scope = args.slug ? ` for ${args.slug}` : "";
    const window = args.since ? ` since ${args.since}` : "";
    return textResult(
      `No confirmed hack incidents${scope}${window}. ${FEED_ATTRIB}`,
    );
  }

  const header =
    `${page.items.length} of ${page.total} confirmed hack incidents, newest first:`;
  const lines = page.items.map(renderIncident);
  const newest = page.items[0]?.detected_at;
  const footer = [
    newest ? `Poll for new ones with since='${newest}'.` : null,
    "An incident is a signal to look, not a grade change: re-rating is always a human decision.",
    FEED_ATTRIB,
  ].filter((s): s is string => s !== null);

  return textResult([header, ...lines, "", ...footer].join("\n"));
}
