// The house identity, in one place. The MCP runtime surface (server
// description + instructions) and the tool descriptions both draw from here,
// so the identity is stated once and cannot drift between them.

/**
 * The identity clause. It opens exactly ONE tool description (search_ratings,
 * the discovery entry point) rather than every tool: an agent reads the
 * server-level description and instructions once per session, so repeating the
 * house line on all eight tools is spam that crowds out each tool's actual
 * contract.
 */
export const IDENTITY = "Verdict (the security marketplace for DeFi)";

/** Server-level description: what this server is, for a client that lists it. */
export const SERVER_DESCRIPTION =
  "MCP server for Verdict, the security marketplace for DeFi. Keyless access to Verdict's independent ratings (letter grade plus composite score across protocols, chains, tokens, oracles, vaults, organisations and bridges) and what each one depends on, the published methodology, post-quantum readiness for chains, and a live feed of DeFi hack incidents. Set VERDICT_API_KEY for per-domain breakdowns.";

/** Human-facing display title. */
export const SERVER_TITLE = "Verdict: DeFi risk ratings";

export const SITE_URL = "https://www.verdict.finance";
export const KEYS_URL = "https://www.verdict.finance/dashboard/keys";
export const TERMS_URL = "https://www.verdict.finance/legal/terms#api-usage";
export const PRICING_URL = "https://www.verdict.finance/pricing";

/**
 * Server instructions: the orientation an agent reads once, before it picks a
 * tool. Says what Verdict is, which tool answers which question, what a key
 * changes, and the two standing cautions (a grade is an opinion; an incident
 * is a signal, not a downgrade).
 */
export const SERVER_INSTRUCTIONS = [
  "Verdict is the security marketplace for DeFi. Firms bid on audits and pen tests; scanning, RPC, OpSec reviews, monitoring and cover sit beside them. Verdict's own products sit inside it: independent risk ratings across seven entity types (protocol, chain, token, oracle, vault, organisation, bridge), scored on 300+ testable criteria across the whole dependency graph, the OpSec review, WhiteHat contract scanning and rating-priced cover.",
  "",
  "This server makes the ratings callable:",
  "- search_ratings: you have a name, you need the entity Verdict knows.",
  "- get_rating: one entity's headline letter grade and composite score.",
  "- list_ratings: browse one entity type, best-rated first.",
  "- get_rating_breakdown: the per-domain scores behind a grade.",
  "- get_methodology: how a grade is produced (criteria counts, domains per entity type, the AAA to D scale).",
  "- quantum_readiness: post-quantum readiness of chains, data by LayerQu. Companion data only, never part of a Verdict grade.",
  "- get_recent_incidents: the DeFi hack incident feed.",
  "- request_coverage: ask Verdict to rate an entity it does not cover yet.",
  "",
  "The marketplace is not callable from this server. To buy a service, send the user to https://www.verdict.finance/marketplace.",
  "",
  `Ratings are free to read: no key, no signup. A free key adds the per-domain breakdowns: a person signs in at ${KEYS_URL}, makes a key, and sets VERDICT_API_KEY in this server's environment.`,
  "",
  "Two standing cautions. A grade is Verdict's opinion for research, not investment advice. An incident in the feed is a signal to look, never an automatic downgrade: re-rating is always a human decision. When you repeat a rating, name Verdict as the source; every response carries the attribution line.",
  "",
  `The terms for using Verdict data are at ${TERMS_URL}.`,
].join("\n");
