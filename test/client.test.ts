import { describe, it, expect, vi, afterEach } from "vitest";
import { HttpVerdictClient, VerdictError } from "../src/client.js";

function mockFetch(status: number, body: unknown) {
  return vi.fn(async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("HttpVerdictClient error mapping", () => {
  it("uses VERDICT_API_BASE when set", async () => {
    const fetchMock = mockFetch(200, { items: [] });
    vi.stubGlobal("fetch", fetchMock);
    const c = new HttpVerdictClient({ base: "https://example.test/api/v1" });
    await c.listEntities("protocol", { search: "aave", limit: 5 });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toBe("https://example.test/api/v1/protocols?search=aave&limit=5");
  });

  it("lowercases the category filter on the wire", async () => {
    const fetchMock = mockFetch(200, { items: [] });
    vi.stubGlobal("fetch", fetchMock);
    const c = new HttpVerdictClient({ base: "https://example.test/api/v1" });
    await c.listEntities("protocol", { category: "Lending" });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("category=lending");
  });

  it("maps 404 to not_found", async () => {
    vi.stubGlobal("fetch", mockFetch(404, { detail: "not found" }));
    const c = new HttpVerdictClient({ base: "https://x.test" });
    await expect(c.getEntity("protocol", "ghost")).rejects.toMatchObject({ kind: "not_found" });
  });

  it("maps 429 to rate_limit", async () => {
    vi.stubGlobal("fetch", mockFetch(429, {}));
    const c = new HttpVerdictClient({ base: "https://x.test" });
    await expect(c.listEntities("chain")).rejects.toMatchObject({ kind: "rate_limit" });
  });

  it("maps 5xx to server", async () => {
    vi.stubGlobal("fetch", mockFetch(503, {}));
    const c = new HttpVerdictClient({ base: "https://x.test" });
    await expect(c.listEntities("token")).rejects.toMatchObject({ kind: "server" });
  });

  it("maps a thrown fetch (network/timeout) to network", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    }));
    const c = new HttpVerdictClient({ base: "https://x.test", timeoutMs: 50 });
    await expect(c.listEntities("oracle")).rejects.toBeInstanceOf(VerdictError);
    await expect(c.listEntities("oracle")).rejects.toMatchObject({ kind: "network" });
  });

  it("returns the latest scorecard's grade/composite, or null when empty", async () => {
    vi.stubGlobal("fetch", mockFetch(200, {
      items: [{ letter_grade: "AA", composite_score: 91.2, status: "published" }],
      total: 1,
    }));
    const c = new HttpVerdictClient({ base: "https://x.test" });
    await expect(c.getLatestRating("protocol", "id-1")).resolves.toEqual({
      letter_grade: "AA",
      composite_score: 91.2,
    });

    vi.stubGlobal("fetch", mockFetch(200, { items: [], total: 0 }));
    await expect(c.getLatestRating("protocol", "id-2")).resolves.toBeNull();
  });
});
