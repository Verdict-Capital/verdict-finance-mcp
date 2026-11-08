import { describe, it, expect } from "vitest";
import {
  deepLink,
  attribution,
  formatItem,
  toRatingItem,
  byGradeDesc,
  detailLines,
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
  it("is one plain credit line with the given link", () => {
    const link = deepLink("chain", "ethereum");
    expect(attribution(link)).toBe(
      "Rating by Verdict: https://www.verdict.finance/products/ratings#chain-ethereum",
    );
  });
  it("defaults to the ratings page when no link is given", () => {
    expect(attribution()).toBe("Rating by Verdict: https://www.verdict.finance/products/ratings");
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
    dragHint: null,
    hasUnratedDeps: false,
  };

  it("renders a rated item with grade, score, chains and link", () => {
    expect(formatItem(base)).toBe(
      "Aave V4: A (87/100) · protocol · chains: ethereum, base · https://www.verdict.finance/products/ratings#protocol-aave",
    );
  });

  it("rounds the composite score", () => {
    expect(formatItem({ ...base, composite: 87.6 })).toContain("A (88/100)");
  });

  it("renders 'unrated' when grade and composite are null", () => {
    const line = formatItem({ ...base, grade: null, composite: null });
    expect(line).toContain("Aave V4: unrated · protocol");
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

describe("withdrawn and matured ratings", () => {
  const eOracle = {
    id: "o1", name: "eOracle", slug: "eoracle", chains: [{ name: "Ethereum" }], categories: [],
    status: "withdrawn", withdrawn_at: "2026-09-28T21:02:14.099179Z", expires_at: null,
  };
  const b = { letter_grade: "B", composite_score: 50.37, largest_drag_hint: null, has_unrated_dependencies: false };

  it("keeps the grade and marks it withdrawn with the day", () => {
    expect(formatItem(toRatingItem("oracle", eOracle, b))).toBe(
      "eOracle: B (50/100), withdrawn 2026-09-28 · oracle · chains: Ethereum · https://www.verdict.finance/products/ratings#oracle-eoracle",
    );
  });

  it("dates the withdrawal by its UTC day", () => {
    const late = { ...eOracle, withdrawn_at: "2026-09-28T23:30:00-05:00" };
    expect(formatItem(toRatingItem("oracle", late, b))).toContain("eOracle: B (50/100), withdrawn 2026-09-29 · oracle");
  });

  it("marks a withdrawn vault whose instrument has expired as matured, on the expiry day", () => {
    const vault = {
      id: "v1", name: "syrupUSDC Sep", slug: "syrupusdc-sep", status: "withdrawn",
      withdrawn_at: "2026-10-14T09:00:00Z", expires_at: "2026-10-12T08:00:00Z",
    };
    const line = formatItem(toRatingItem("vault", vault, { ...b, letter_grade: "BBB", composite_score: 74 }));
    expect(line).toContain("syrupUSDC Sep: BBB (74/100), matured 2026-10-12 · vault");
    expect(line).not.toContain("withdrawn");
  });

  it("marks a withdrawn vault that has not expired as withdrawn", () => {
    const vault = {
      id: "v1", name: "Live Vault", slug: "live-vault", status: "withdrawn",
      withdrawn_at: "2026-10-14T09:00:00Z", expires_at: "2099-01-01T00:00:00Z",
    };
    expect(formatItem(toRatingItem("vault", vault, b))).toContain("Live Vault: B (50/100), withdrawn 2026-10-14 · vault");
  });

  it("reads expires_at only on a vault", () => {
    const token = { ...eOracle, name: "Old Token", slug: "old-token", expires_at: "2026-10-12T08:00:00Z" };
    expect(formatItem(toRatingItem("token", token, b))).toContain("Old Token: B (50/100), withdrawn 2026-09-28 · token");
  });

  it("leaves a published rating unmarked", () => {
    const live = { ...eOracle, status: "published", withdrawn_at: null };
    expect(formatItem(toRatingItem("oracle", live, b))).toContain("eOracle: B (50/100) · oracle");
  });
});

describe("detailLines", () => {
  const base: RatingItem = {
    name: "Aave V4", entityType: "protocol", slug: "aave",
    grade: "BBB", composite: 77.51, chains: ["Ethereum"], categories: ["lending"],
    dragHint: null, hasUnratedDeps: false,
  };
  it("is empty when there is no drag information", () => {
    expect(detailLines(base)).toEqual([]);
  });
  it("renders the drag hint", () => {
    expect(detailLines({ ...base, dragHint: "chain: ethereum" }))
      .toEqual(["Dependency drag: chain: ethereum"]);
  });
  it("renders the unrated-dependencies note", () => {
    expect(detailLines({ ...base, hasUnratedDeps: true }))
      .toEqual(["Note: some dependencies are not yet rated."]);
  });
  it("renders hint first when both apply", () => {
    expect(detailLines({ ...base, dragHint: "oracle: pyth", hasUnratedDeps: true }))
      .toEqual(["Dependency drag: oracle: pyth", "Note: some dependencies are not yet rated."]);
  });
});

describe("byGradeDesc", () => {
  it("sorts rated (higher composite) before unrated", () => {
    const items: RatingItem[] = [
      { name: "Z", entityType: "protocol", slug: "z", grade: null, composite: null, chains: [], categories: [], dragHint: null, hasUnratedDeps: false },
      { name: "A", entityType: "protocol", slug: "a", grade: "B", composite: 70, chains: [], categories: [], dragHint: null, hasUnratedDeps: false },
      { name: "B", entityType: "protocol", slug: "b", grade: "A", composite: 90, chains: [], categories: [], dragHint: null, hasUnratedDeps: false },
    ];
    const sorted = [...items].sort(byGradeDesc).map((i) => i.name);
    expect(sorted).toEqual(["B", "A", "Z"]);
  });
});
