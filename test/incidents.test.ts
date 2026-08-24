import { describe, it, expect } from "vitest";
import { getRecentIncidents } from "../src/tools/incidents.js";
import { HttpVerdictClient, type Incident } from "../src/client.js";
import { FakeClient } from "./helpers.js";

function text(r: { content: { type: string; text?: string }[] }): string {
  return r.content.map((c) => c.text ?? "").join("\n");
}

function incident(over: Partial<Incident> & { incident_id: string; protocol_name: string }): Incident {
  return {
    slug: null,
    matched_protocol: false,
    status: "confirmed",
    exploit_class: "REENTRANCY",
    loss_estimate_usd: 6_020_000,
    chain: "ethereum",
    confidence_bps: 10000,
    source_count: 5,
    sources: [{ handle: "blockaid" }],
    detected_at: "2026-08-20T10:00:00Z",
    first_seen_at: "2026-08-20T09:55:00Z",
    resolved_at: null,
    resolution: null,
    ...over,
  };
}

describe("get_recent_incidents tool", () => {
  it("renders one line per incident with attribution", async () => {
    const c = new FakeClient();
    c.incidents = {
      items: [incident({ incident_id: "i-1", protocol_name: "Summer Fi" })],
      total: 1,
    };
    const t = text(await getRecentIncidents(c, {}));
    expect(t).toContain("Summer Fi - first reported 2026-08-20");
    expect(t).toContain("REENTRANCY");
    expect(t).toContain("~$6.0M");
    expect(t).toContain("5 sources");
    expect(t).toContain("Confirmed hack feed by Verdict");
  });

  it("dates the line by when it was first reported, not when confirmed", async () => {
    // A whole batch can share one detected_at (the confirmation sweep), so
    // dating lines by it would show a dozen unrelated hacks as all happening
    // the same day. first_seen_at is when each was actually reported.
    const c = new FakeClient();
    c.incidents = {
      items: [incident({
        incident_id: "i-1", protocol_name: "Summer Fi",
        first_seen_at: "2026-08-14T09:00:00Z",
        detected_at: "2026-08-24T21:12:18Z",
      })],
      total: 1,
    };
    const t = text(await getRecentIncidents(c, {}));
    expect(t).toContain("first reported 2026-08-14");
    expect(t).toContain("since='2026-08-24T21:12:18Z'");
  });

  it("says an incident is not a grade change", async () => {
    // The line exists so an agent summarising the feed cannot present an
    // incident as a downgrade Verdict has already applied.
    const c = new FakeClient();
    c.incidents = {
      items: [incident({ incident_id: "i-1", protocol_name: "Summer Fi" })],
      total: 1,
    };
    const t = text(await getRecentIncidents(c, {}));
    expect(t).toContain("re-rating is always a human decision");
  });

  it("distinguishes a rated protocol from an unrated one", async () => {
    const c = new FakeClient();
    c.incidents = {
      items: [
        incident({
          incident_id: "i-rated", protocol_name: "Rated Co",
          slug: "rated-co", matched_protocol: true,
        }),
        incident({
          incident_id: "i-unrated", protocol_name: "Unrated Co",
          detected_at: "2026-08-19T10:00:00Z",
        }),
      ],
      total: 2,
    };
    const t = text(await getRecentIncidents(c, {}));
    expect(t).toContain("rated by Verdict as rated-co");
    expect(t).toContain("not a Verdict-rated protocol at detection");
  });

  it("offers the newest timestamp back as the next since value", async () => {
    const c = new FakeClient();
    c.incidents = {
      items: [incident({ incident_id: "i-1", protocol_name: "Summer Fi" })],
      total: 1,
    };
    const t = text(await getRecentIncidents(c, {}));
    expect(t).toContain("since='2026-08-20T10:00:00Z'");
  });

  it("reports the page against the total", async () => {
    const c = new FakeClient();
    c.incidents = {
      items: [incident({ incident_id: "i-1", protocol_name: "A" })],
      total: 13,
    };
    expect(text(await getRecentIncidents(c, { limit: 1 }))).toContain("1 of 13");
  });

  it("passes since, slug and limit straight through", async () => {
    const c = new FakeClient();
    await getRecentIncidents(c, {
      since: "2026-08-01T00:00:00Z", slug: "aave-v4", limit: 5,
    });
    expect(c.lastIncidentParams).toEqual({
      since: "2026-08-01T00:00:00Z", slug: "aave-v4", limit: 5,
    });
  });

  it("renders an empty feed as text, not an error", async () => {
    const c = new FakeClient();
    const r = await getRecentIncidents(c, { slug: "aave-v4" });
    expect(text(r)).toContain("No confirmed hack incidents for aave-v4");
    expect(r.isError).toBeFalsy();
  });

  it("never throws when the client errors", async () => {
    const c = new FakeClient();
    c.throwOn.incidents = "network";
    const r = await getRecentIncidents(c, {});
    expect(text(r)).toContain("Couldn't reach Verdict");
    expect(r.isError).toBe(true);
  });

  it("handles a missing loss estimate", async () => {
    const c = new FakeClient();
    c.incidents = {
      items: [incident({ incident_id: "i-1", protocol_name: "A", loss_estimate_usd: null })],
      total: 1,
    };
    expect(text(await getRecentIncidents(c, {}))).toContain("loss unknown");
  });
});

describe("incident query encoding", () => {
  it("percent-encodes a +00:00 offset so the API never sees a space", async () => {
    // The transport trap: pasted raw into a query string, the "+" in an ISO
    // offset decodes as a space and the API answers 422. URLSearchParams is
    // what keeps callers from ever meeting that.
    let seen = "";
    const client = new HttpVerdictClient({ base: "https://example.invalid/api/v1" });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string | URL) => {
      seen = String(url);
      return new Response(JSON.stringify({ items: [], total: 0 }), {
        status: 200, headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
    try {
      await client.listIncidents({ since: "2026-08-23T12:00:00+00:00" });
    } finally {
      globalThis.fetch = originalFetch;
    }
    expect(seen).toContain("since=2026-08-23T12%3A00%3A00%2B00%3A00");
    expect(seen).not.toContain("+00:00");
  });
});
