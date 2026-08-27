import { describe, it, expect } from "vitest";
import { FakeClient } from "./helpers.js";
import { requestCoverage, requestCoverageMeta } from "../src/tools/coverage.js";

function text(r: { content: Array<{ text?: string }> }): string {
  return r.content.map((c) => c.text ?? "").join("\n");
}

const ARGS = {
  entity_name: "Morpho Blue",
  entity_type: "protocol" as const,
  contact_email: "team@example.com",
};

describe("request_coverage", () => {
  it("submits as a rating-request and confirms with the reference id", async () => {
    const c = new FakeClient();
    c.contactReceipt = { id: "req-123", status: "new" };
    const r = await requestCoverage(c, ARGS);
    const t = text(r);
    expect(r.isError).toBeFalsy();
    expect(c.lastContactSubmission?.request_type).toBe("rating-request");
    expect(c.lastContactSubmission?.protocol_name).toBe("Morpho Blue");
    expect(c.lastContactSubmission?.contact_email).toBe("team@example.com");
    expect(t).toContain("Morpho Blue");
    expect(t).toContain("req-123");
    expect(t).toContain("team@example.com");
  });

  it("carries the entity type and the note into the message body", async () => {
    const c = new FakeClient();
    const r = await requestCoverage(c, { ...ARGS, note: "Live on Base since June." });
    expect(r.isError).toBeFalsy();
    expect(c.lastContactSubmission?.message).toContain("protocol");
    expect(c.lastContactSubmission?.message).toContain("Live on Base since June.");
  });

  it("says the resulting rating is public either way", async () => {
    const c = new FakeClient();
    const r = await requestCoverage(c, ARGS);
    expect(text(r)).toContain("public either way");
  });

  it("confirms even when the receipt carries no id", async () => {
    const c = new FakeClient();
    c.contactReceipt = {};
    const r = await requestCoverage(c, ARGS);
    expect(r.isError).toBeFalsy();
    expect(text(r)).toContain("Morpho Blue");
  });

  it("explains the per-IP submission limit on a 429 instead of the read limit", async () => {
    const c = new FakeClient();
    c.throwOn.contact = "rate_limit";
    const r = await requestCoverage(c, ARGS);
    const t = text(r);
    expect(t).toContain("https://www.verdict.finance/contact");
    expect(t).not.toContain("120/min");
  });

  it("returns friendly text, not a throw, when the API is down", async () => {
    const c = new FakeClient();
    c.throwOn.contact = "server";
    const r = await requestCoverage(c, ARGS);
    expect(r.isError).toBe(true);
    expect(text(r)).toContain("Couldn't reach Verdict right now");
  });

  it("frames coverage as independent of the grade in its description", () => {
    expect(requestCoverageMeta.description).toContain("public either way");
    expect(requestCoverageMeta.description).not.toContain("due-diligence house");
  });
});
