# verdict-finance-mcp

[Verdict](https://www.verdict.finance) is the institutional diligence layer for
DeFi: independent ratings, rating-priced cover, security testing and continuous
monitoring, across seven entity types. This
[Model Context Protocol](https://modelcontextprotocol.io) server lets AI agents
call that layer directly.

**Live today: Verdict Ratings.** Letter grade (AAA to D) plus a composite score
(0 to 100) built from 300+ criteria across the full dependency graph, for
protocols, chains, tokens, oracles, vaults, organisations and bridges.

Keyless. It wraps Verdict's live anonymous API, so there is no signup and no
API key. Each user runs it locally and queries from their own IP.

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

That is it. No key. (Requires Node 20+.)

## Tools

| Tool | What it does |
| --- | --- |
| `search_ratings({ query, entity_type? })` | Find entities by name or keyword. Omit `entity_type` to search all 7 types at once. |
| `get_rating({ entity_type, identifier })` | Full free-tier rating for one entity, by slug (`aave-v4`, `ethereum`) or UUID. Includes dependency-drag provenance when it shaped the grade. |
| `list_ratings({ entity_type, category?, chain?, limit? })` | Browse a set, best-rated first (default 25, cap 50). Category filters are lowercase, e.g. `lending`. |

Every response ends with an attribution line linking back to the rating on
verdict.finance.

### Example prompts

- *"What does Verdict rate Aave?"* runs `get_rating({ entity_type: "protocol", identifier: "aave-v4" })`
- *"Search Verdict for Chainlink."* runs `search_ratings({ query: "chainlink" })`
- *"List the chains Verdict rates."* runs `list_ratings({ entity_type: "chain" })`

### Example output

```
Aave V4 — BBB (78/100) · protocol · chains: Ethereum · categories: lending · https://www.verdict.finance/products/ratings#protocol-aave-v4

Rating by Verdict — https://www.verdict.finance/products/ratings#protocol-aave-v4 · Methodology + deeper analysis at https://www.verdict.finance
```

Entities that are not yet rated render as `unrated`. When a rating was pulled
down by a weak dependency, the response says which one.

## The roadmap: the callable trust layer

Verdict's diligence lifecycle is Assess, Rate, Cover, Secure, Monitor. Ratings
are the first module agents can call. As the rest of the stack becomes
callable, this server grows a module per product:

- **Cover**: rating-priced parametric cover on rated protocols.
- **Audits**: hand over a repo, receive blind bids from top audit firms.
- **Monitoring**: watchlists, live alerts and webhooks on rated entities.
- **Pen testing**: engage frontend penetration tests.

Tool names are module-scoped (`search_ratings`, `get_rating`, `list_ratings`)
so new modules arrive without breaking existing agents.

## How it works

Verdict's read API is anonymous and rate-limited per IP (120/min, 20k/day).
This server:

- lists and looks up entities via `GET /{type}s` and `GET /{type}s/{identifier}`, and
- fetches each entity's latest published scorecard
  (`GET /{type}s/{id}/scorecards`) for the grade + composite score.

The API base is `https://api.verdict.finance/api/v1` and can be overridden with
the `VERDICT_API_BASE` environment variable (used for testing). The full API
surface is documented at
[api.verdict.finance/openapi.json](https://api.verdict.finance/openapi.json).

Rate limits and outages are handled gracefully. Tools return a friendly text
message, never a crash.

## Attribution and trademark

Ratings and methodology are © Verdict. This tool surfaces the free tier; the
full methodology, domain breakdowns and deeper analysis live at
[verdict.finance](https://www.verdict.finance). The code is Apache-2.0; the
Verdict name and branding are not licensed by it.

## Development

```bash
npm install
npm run build     # tsc -> dist/
npm test          # vitest (unit tests, HTTP client mocked)

# optional live smoke against the real API:
VERDICT_LIVE_SMOKE=1 npx vitest run test/live.smoke.test.ts
```

## License

Apache-2.0. Copyright 2026 Verdict Capital.
