import { describe, it, expect } from "vitest";
import {
  deepLink,
  attribution,
  formatItem,
  toRatingItem,
  byGradeDesc,
  type RatingItem,
} from "../src/format.js";

describe("deepLink", () => {
  it("builds the #<type>-<slug> ratings link", () => {
    expect(deepLink("protocol", "aave")).toBe(
      "https://www.verdict.finance/products/ratings#protocol-aave",
    );
  });
});

describe("attribution", () => {
  it("ends with the methodology funnel and uses the given link", () => {
    const link = deepLink("chain", "ethereum");
    expect(attribution(link)).toBe(
      `Rating by Verdict — ${link} · Methodology + deeper analysis at https://www.verdict.finance`,
    );
  });
  it("defaults to the ratings page when no link is given", () => {
    expect(attribution()).toContain("https://www.verdict.finance/products/ratings ·");
  });
});

describe("formatItem", () => {
  const base: RatingItem = {
    name: "Aave V4",
    entityType: "protocol",
    slug: "aave",
    grade: "A",
    composite: 87,
    chains: ["ethereum", "base"],
    categories: ["Lending"],
  };

  it("renders a rated item with grade, score, chains and link", () => {
    expect(formatItem(base)).toBe(
      "Aave V4 — A (87/100) · protocol · chains: ethereum, base · https://www.verdict.finance/products/ratings#protocol-aave",
    );
  });

  it("rounds the composite score", () => {
    expect(formatItem({ ...base, composite: 87.6 })).toContain("A (88/100)");
  });

  it("renders 'unrated' when grade and composite are null", () => {
    const line = formatItem({ ...base, grade: null, composite: null });
    expect(line).toContain("Aave V4 — unrated · protocol");
  });

  it("omits the chains segment when there are none", () => {
    const line = formatItem({ ...base, chains: [] });
    expect(line).not.toContain("chains:");
  });

  it("includes categories only when asked", () => {
    expect(formatItem(base, { categories: true })).toContain("categories: Lending");
    expect(formatItem(base)).not.toContain("categories:");
  });
});

describe("toRatingItem", () => {
  it("maps letter_grade/composite_score and chain names", () => {
    const item = toRatingItem(
      "protocol",
      { id: "1", name: "Aave V4", slug: "aave", chains: [{ name: "Ethereum", slug: "ethereum" }], categories: ["Lending"] },
      { letter_grade: "A", composite_score: 87 },
    );
    expect(item.grade).toBe("A");
    expect(item.composite).toBe(87);
    expect(item.chains).toEqual(["Ethereum"]);
  });

  it("treats a null rating as unrated", () => {
    const item = toRatingItem("chain", { id: "1", name: "X", slug: "x" }, null);
    expect(item.grade).toBeNull();
    expect(item.composite).toBeNull();
  });
});

describe("byGradeDesc", () => {
  it("sorts rated (higher composite) before unrated", () => {
    const items: RatingItem[] = [
      { name: "Z", entityType: "protocol", slug: "z", grade: null, composite: null, chains: [], categories: [] },
      { name: "A", entityType: "protocol", slug: "a", grade: "B", composite: 70, chains: [], categories: [] },
      { name: "B", entityType: "protocol", slug: "b", grade: "A", composite: 90, chains: [], categories: [] },
    ];
    const sorted = [...items].sort(byGradeDesc).map((i) => i.name);
    expect(sorted).toEqual(["B", "A", "Z"]);
  });
});
