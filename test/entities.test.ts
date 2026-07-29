import { describe, it, expect } from "vitest";
import { ENTITY_TYPES, isEntityType, pluralOf } from "../src/entities.js";

describe("entities", () => {
  it("has all 7 types", () => {
    expect(ENTITY_TYPES).toHaveLength(7);
    expect(ENTITY_TYPES).toContain("organisation");
    expect(ENTITY_TYPES).toContain("bridge");
  });

  it("validates known + unknown types", () => {
    expect(isEntityType("protocol")).toBe(true);
    expect(isEntityType("Protocol")).toBe(false);
    expect(isEntityType("nonsense")).toBe(false);
  });

  it("pluralises every type", () => {
    expect(pluralOf("protocol")).toBe("protocols");
    expect(pluralOf("organisation")).toBe("organisations");
    for (const t of ENTITY_TYPES) {
      expect(pluralOf(t)).toMatch(/s$/);
    }
  });
});
