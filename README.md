# verdict-finance-mcp

[Verdict](https://www.verdict.finance) is the due-diligence house for DeFi:
independent ratings, rating-priced cover, security testing and continuous
monitoring, plus a security partner marketplace for audits, monitoring and pen
testing, across seven entity types. This
[Model Context Protocol](https://modelcontextprotocol.io) server lets AI agents
call that house directly.

**Live today: Ratings.** Letter grade (AAA to D) plus a composite score
(0 to 100) built from 300+ criteria across the full dependency graph, for
protocols, chains, tokens, oracles, vaults, organisations and bridges. Plus
post-quantum readiness for chains, and a live feed of DeFi hack incidents
(confirmed by default).

Keyless by default. It wraps Verdict's live anonymous API, so there is no signup
and no API key. Each user runs it locally and queries from their own IP. Bring
your own key if you want the per-domain breakdown behind a grade (see below).

## Install

Add to your MCP client config (Claude Desktop: `claude_desktop_config.json`;
Claude Code: `.mcp.json`):

```json
{
  "mcpServers": {
    "verdict-finance": {
      "command": "npx",
      "args": ["-y", "verdict-finance-mcp"]
    }
  }
}
```

That is it. No key needed to read ratings. (Requires Node 20+.)

## Tools

| Tool | What it does |
| --- | --- |
| `search_ratings({ query, entity_type? })` | Find entities by name or keyword. Omit `entity_type` to search all 7 types at once. |
| `get_rating({ entity_type, identifier })` | Letter grade, composite score and public metadata for one entity, by slug (`aave-v4`, `ethereum`) or UUID. Includes dependency-drag provenance when it shaped the grade. |
| `list_ratings({ entity_type, category?, chain?, limit? })` | Browse a set, best-rated first (default 25, cap 50). Category filters are lowercase, e.g. `lending`. |
| `quantum_readiness({ chain? })` | Post-quantum cryptographic readiness for chains (QRI 0-100, readiness band, migration stage, hybrid-signature status), data by LayerQu. Omit `chain` for the full 72+ chain league table, including chains Verdict has not rated. |
| `get_recent_incidents({ since?, slug?, min_status?, limit? })` | DeFi hack incidents, newest first (default 25, cap 200). Confirmed by default; `min_status: 'corroborated'` opts into multi-source leads that have not yet reached confirmation. Each is corroborated by more than one public hack-reporting source. Poll with `since`; filter to one rated protocol with `slug`. |
| `get_methodology({})` | The published methodology: criteria counts and domains per entity type, and the AAA to D grade scale with the composite band each grade needs. |
| `get_rating_breakdown({ entity_type, slug })` | The per-domain scores behind one entity's grade, plus its intrinsic (pre-dependency) pair. Needs an API key; see [Bring your own key](#bring-your-own-key). |
| `request_coverage({ entity_name, entity_type, contact_email, note? })` | Ask Verdict to rate an entity it does not cover yet. Returns a reference id. The resulting rating is public either way; requesting coverage never buys or moves a grade. |

Every rating response ends with an attribution line linking back to the rating
on verdict.finance.

## Bring your own key

Ratings are free to read: the tools above work with no key at all. Set
`VERDICT_API_KEY` and the server authenticates every call, which adds
`get_rating_breakdown` (per-domain scores). Keys come from the Verdict
dashboard at [verdict.finance](https://www.verdict.finance); plans are at
[verdict.finance/pricing](https://www.verdict.finance/pricing).

```json
{
  "mcpServers": {
    "verdict-finance": {
      "command": "npx",
      "args": ["-y", "verdict-finance-mcp"],
      "env": { "VERDICT_API_KEY": "your-key" }
    }
  }
}
```

Without the variable the server behaves exactly as it always has: no header is
sent, and nothing about the keyless path changes. The key is never logged,
echoed, or included in tool output. Called without a key,
`get_rating_breakdown` answers with where to get one rather than failing.

Agent-native micropayment access (x402) is the announced direction. It is not
shipped, and nothing here is behind a paywall today.

Quantum-readiness data is provided by
[LayerQu](https://layerqu.com/dashboard/) and is companion data only. It never
feeds a Verdict grade; chain ratings simply carry an extra LayerQu line when a
reading is available.

The incident feed carries hack incidents across DeFi (confirmed by default),
including ones at protocols Verdict does not rate. Two things are worth
knowing when reading it. Matching to a rated protocol happens when an incident
is received, and re-runs when an incident escalates and its payload improves,
so matched_protocol reads as of the incident's current tier. It is still never
retroactive when Verdict's own coverage grows. And an incident is a signal to
look, never an automatic downgrade: a matched entity may be flagged under
review, but re-rating is always a human decision.

### Example prompts

- *"What does Verdict rate Aave?"* runs `get_rating({ entity_type: "protocol", identifier: "aave-v4" })`
- *"Search Verdict for Chainlink."* runs `search_ratings({ query: "chainlink" })`
- *"List the chains Verdict rates."* runs `list_ratings({ entity_type: "chain" })`
- *"Is Ethereum quantum-ready?"* runs `quantum_readiness({ chain: "ethereum" })`
- *"Any DeFi hacks this week?"* runs `get_recent_incidents({ limit: 10 })`
- *"How does Verdict score a bridge?"* runs `get_methodology({})`
- *"What dragged Aave's grade down?"* runs `get_rating_breakdown({ entity_type: "protocol", slug: "aave-v4" })`
- *"Get my protocol rated."* runs `request_coverage({ entity_name: "...", entity_type: "protocol", contact_email: "..." })`

### Example output

```
Aave V4 — BBB (78/100) · protocol · chains: Ethereum · categories: lending · https://www.verdict.finance/products/ratings#protocol-aave-v4

Rating by Verdict — https://www.verdict.finance/products/ratings#protocol-aave-v4 · Methodology + deeper analysis at https://www.verdict.finance
```

Entities that are not yet rated render as `unrated`. When a rating was pulled
down by a weak dependency, the response says which one.

## The roadmap: the callable marketplace

Verdict's diligence lifecycle is Assess, Rate, Cover, Secure, Monitor. Ratings
are the first module agents can call. As the rest of the house becomes
callable, this server grows a module per product:

- **Cover**: rating-priced parametric cover on rated protocols.
- **Audit Marketplace**: hand over a repo, receive blind bids from vetted audit
  firms.
- **Monitoring Marketplace**: watchlists, live alerts and webhooks on rated
  entities.
- **Pen Test Marketplace**: engage penetration tests through vetted partner
  firms, scoped and priced per engagement by the partner.

The rating function stays structurally separate from what the marketplace
sells: buying a service never moves a grade.

Tool names are module-scoped (`search_ratings`, `get_rating`, `list_ratings`)
so new modules arrive without breaking existing agents.

## How it works

Verdict's read API is anonymous and rate-limited per IP (120/min, 20k/day).
This server:

- lists and looks up entities via `GET /{type}s` and `GET /{type}s/{identifier}`,
- fetches each entity's latest published scorecard
  (`GET /{type}s/{id}/scorecards`) for the grade + composite score,
- reads the published methodology from `GET /methodology`,
- reads per-domain scores from `GET /{type}s/{slug}/domains` (the one route that
  needs a key), and
- submits coverage requests to `POST /contacts`, the same public endpoint the
  "Get rated" form on verdict.finance posts to.

The API base is `https://api.verdict.finance/api/v1` and can be overridden with
the `VERDICT_API_BASE` environment variable (used for testing). Set
`VERDICT_API_KEY` to authenticate; leave it unset to stay keyless. The full API
surface is documented at
[api.verdict.finance/openapi.json](https://api.verdict.finance/openapi.json).

Rate limits and outages are handled gracefully. Tools return a friendly text
message, never a crash.

## Attribution and trademark

Ratings and methodology are © Verdict. This tool surfaces the public ratings
and the published methodology; the deeper analysis lives at
[verdict.finance](https://www.verdict.finance). The code is Apache-2.0; the
Verdict name and branding are not licensed by it.

## Development

```bash
npm install
npm run build     # tsc -> dist/
npm test          # vitest (unit tests, HTTP client mocked)

# optional live smoke against the real API:
VERDICT_LIVE_SMOKE=1 npx vitest run test/live.smoke.test.ts

# the smoke's one keyed case (get_rating_breakdown) skips unless a key is set:
VERDICT_LIVE_SMOKE=1 VERDICT_API_KEY=... npx vitest run test/live.smoke.test.ts
```

## License

Apache-2.0. Copyright 2026 Verdict Capital.
