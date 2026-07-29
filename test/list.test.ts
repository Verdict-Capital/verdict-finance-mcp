import { describe, it, expect } from "vitest";
import { listRatings } from "../src/tools/list.js";
import { FakeClient, entity } from "./helpers.js";

function text(r: { content: { type: string; text?: string }[] }): string {
  return r.content.map((c) => c.text ?? "").join("\n");
}

describe("list_ratings", () => {
  it("lists a type, best-rated first", async () => {
    const c = new FakeClient();
    c.entities.vault = [
      entity({ id: "v1", name: "Low Vault", slug: "low" }),
      entity({ id: "v2", name: "High Vault", slug: "high" }),
    ];
    c.ratings.v1 = { letter_grade: "C", composite_score: 55 };
    c.ratings.v2 = { letter_grade: "A", composite_score: 92 };

    const r = await listRatings(c, { entity_type: "vault" });
    const t = text(r);
    expect(t.indexOf("High Vault")).toBeLessThan(t.indexOf("Low Vault"));
    expect(t).toContain("Rating by Verdict —");
  });

  it("caps the limit at 50", async () => {
    const c = new FakeClient();
    c.entities.protocol = [];
    await listRatings(c, { entity_type: "protocol", limit: 999 });
    expect(c.lastListParams?.limit).toBe(50);
  });

  it("defaults the limit to 25", async () => {
    const c = new FakeClient();
    c.entities.protocol = [];
    await listRatings(c, { entity_type: "protocol" });
    expect(c.lastListParams?.limit).toBe(25);
  });

  it("passes category and chain filters through", async () => {
    const c = new FakeClient();
    c.entities.protocol = [];
    await listRatings(c, { entity_type: "protocol", category: "Lending", chain: "ethereum" });
    expect(c.lastListParams?.category).toBe("Lending");
    expect(c.lastListParams?.chain).toBe("ethereum");
  });

  it("returns a friendly empty message naming the filters", async () => {
    const c = new FakeClient();
    c.entities.bridge = [];
    const r = await listRatings(c, { entity_type: "bridge", category: "Messaging" });
    expect(text(r)).toContain("No bridge ratings found matching category 'Messaging'.");
    expect(r.isError).toBeFalsy();
  });

  it("maps a server error to a graceful message", async () => {
    const c = new FakeClient();
    c.throwOn.list = "server";
    const r = await listRatings(c, { entity_type: "protocol" });
    expect(text(r)).toBe("Couldn't reach Verdict right now; try again.");
    expect(r.isError).toBe(true);
  });
});
