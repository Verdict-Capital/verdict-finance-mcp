import { describe, it, expect } from "vitest";
import { z } from "zod";
import { entityTypeSchema } from "../src/schema.js";
import { searchRatingsInput } from "../src/tools/search.js";
import { listRatingsInput } from "../src/tools/list.js";

describe("entityTypeSchema", () => {
  it("accepts the 7 valid types and rejects others", () => {
    expect(entityTypeSchema.safeParse("protocol").success).toBe(true);
    expect(entityTypeSchema.safeParse("bridge").success).toBe(true);
    expect(entityTypeSchema.safeParse("Protocol").success).toBe(false);
    expect(entityTypeSchema.safeParse("nft").success).toBe(false);
  });
});

describe("tool input schemas", () => {
  it("search requires a non-empty query and an optional valid entity_type", () => {
    const schema = z.object(searchRatingsInput);
    expect(schema.safeParse({ query: "aave" }).success).toBe(true);
    expect(schema.safeParse({ query: "" }).success).toBe(false);
    expect(schema.safeParse({ query: "aave", entity_type: "protocol" }).success).toBe(true);
    expect(schema.safeParse({ query: "aave", entity_type: "widget" }).success).toBe(false);
  });

  it("list caps the limit at 50 and requires a valid entity_type", () => {
    const schema = z.object(listRatingsInput);
    expect(schema.safeParse({ entity_type: "vault", limit: 25 }).success).toBe(true);
    expect(schema.safeParse({ entity_type: "vault", limit: 51 }).success).toBe(false);
    expect(schema.safeParse({ entity_type: "vault", limit: -1 }).success).toBe(false);
    expect(schema.safeParse({ limit: 10 }).success).toBe(false); // missing entity_type
  });
});
