// Bring-your-own-key: VERDICT_API_KEY present authenticates every call;
// absent, the client is byte-for-byte the keyless client it has always been.

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { HttpVerdictClient } from "../src/client.js";

function mockFetch(status: number, body: unknown) {
  return vi.fn(async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  );
}

function headersOf(fetchMock: ReturnType<typeof mockFetch>): Record<string, string> {
  const init = fetchMock.mock.calls[0][1] as RequestInit;
  return (init.headers ?? {}) as Record<string, string>;
}

const KEY = "vk_live_secret_value";

beforeEach(() => {
  delete process.env.VERDICT_API_KEY;
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.VERDICT_API_KEY;
});

describe("keyless (the default)", () => {
  it("sends exactly the accept header, and nothing else", async () => {
    const fetchMock = mockFetch(200, { items: [] });
    vi.stubGlobal("fetch", fetchMock);
    await new HttpVerdictClient({ base: "https://x.test" }).listEntities("protocol");
    expect(headersOf(fetchMock)).toEqual({ accept: "application/json" });
  });

  it("reports no key", () => {
    expect(new HttpVerdictClient({ base: "https://x.test" }).hasApiKey()).toBe(false);
  });

  it("treats an empty or whitespace VERDICT_API_KEY as absent", async () => {
    process.env.VERDICT_API_KEY = "   ";
    const fetchMock = mockFetch(200, { items: [] });
    vi.stubGlobal("fetch", fetchMock);
    const c = new HttpVerdictClient({ base: "https://x.test" });
    await c.listEntities("chain");
    expect(c.hasApiKey()).toBe(false);
    expect(headersOf(fetchMock)).toEqual({ accept: "application/json" });
  });
});

describe("keyed (VERDICT_API_KEY set)", () => {
  it("adds the Bearer header to a read", async () => {
    process.env.VERDICT_API_KEY = KEY;
    const fetchMock = mockFetch(200, { items: [] });
    vi.stubGlobal("fetch", fetchMock);
    const c = new HttpVerdictClient({ base: "https://x.test" });
    await c.listEntities("protocol");
    expect(c.hasApiKey()).toBe(true);
    expect(headersOf(fetchMock).authorization).toBe(`Bearer ${KEY}`);
  });

  it("trims a key pasted with surrounding whitespace", async () => {
    process.env.VERDICT_API_KEY = `  ${KEY}\n`;
    const fetchMock = mockFetch(200, {});
    vi.stubGlobal("fetch", fetchMock);
    await new HttpVerdictClient({ base: "https://x.test" }).getMethodology();
    expect(headersOf(fetchMock).authorization).toBe(`Bearer ${KEY}`);
  });

  it("authenticates the domains route and builds the plural path", async () => {
    const fetchMock = mockFetch(200, { entity: { slug: "ccip", name: "CCIP" } });
    vi.stubGlobal("fetch", fetchMock);
    const c = new HttpVerdictClient({ base: "https://x.test", apiKey: KEY });
    await c.getDomains("bridge", "ccip");
    expect(fetchMock.mock.calls[0][0]).toBe("https://x.test/bridges/ccip/domains");
    expect(headersOf(fetchMock).authorization).toBe(`Bearer ${KEY}`);
  });

  it("authenticates a POST and sends JSON", async () => {
    const fetchMock = mockFetch(201, { id: "req-1", status: "new" });
    vi.stubGlobal("fetch", fetchMock);
    const c = new HttpVerdictClient({ base: "https://x.test", apiKey: KEY });
    await c.submitContactRequest({
      protocol_name: "X",
      contact_email: "a@b.test",
      request_type: "rating-request",
      message: "m",
    });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(fetchMock.mock.calls[0][0]).toBe("https://x.test/contacts");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(
      JSON.stringify({
        protocol_name: "X",
        contact_email: "a@b.test",
        request_type: "rating-request",
        message: "m",
      }),
    );
    expect((init.headers as Record<string, string>)["content-type"]).toBe("application/json");
  });

  it("maps 401 and 403 to unauthorized, and never puts the key in the error", async () => {
    for (const status of [401, 403]) {
      vi.stubGlobal("fetch", mockFetch(status, { detail: { error: "missing_key" } }));
      const c = new HttpVerdictClient({ base: "https://x.test", apiKey: KEY });
      await expect(c.getDomains("protocol", "aave-v4")).rejects.toMatchObject({
        kind: "unauthorized",
      });
      await c.getDomains("protocol", "aave-v4").catch((e: Error) => {
        expect(e.message).not.toContain(KEY);
      });
    }
  });
});
