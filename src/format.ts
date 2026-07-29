// Agent-readable rendering + the verdict.finance deep link and attribution.

import type { EntityType } from "./entities.js";
import type { EntityRecord, Rating } from "./client.js";

const SITE = "https://www.verdict.finance";
const RATINGS = `${SITE}/products/ratings`;

/** A single entity merged with its latest rating, ready to render. */
export interface RatingItem {
  name: string;
  entityType: EntityType;
  slug: string;
  grade: string | null;
  composite: number | null;
  chains: string[];
  categories: string[];
}

/**
 * Per-entity deep link. The ratings page routes a `#{type}-{slug}` hash to the
 * matching entity tab and scrolls to the live ratings section.
 */
export function deepLink(entityType: EntityType, slug: string): string {
  return `${RATINGS}#${entityType}-${slug}`;
}

export function toRatingItem(
  entityType: EntityType,
  entity: EntityRecord,
  rating: Rating | null,
): RatingItem {
  const chains = (entity.chains ?? [])
    .map((c) => c.name ?? c.slug ?? "")
    .filter((s): s is string => s.length > 0);
  return {
    name: entity.name,
    entityType,
    slug: entity.slug,
    grade: rating?.letter_grade ?? null,
    composite: rating?.composite_score ?? null,
    chains,
    categories: entity.categories ?? [],
  };
}

/** "A (87/100)" | "A" | "(87/100)" | "unrated" */
function ratingBadge(grade: string | null, composite: number | null): string {
  const score = composite == null ? null : Math.round(composite);
  if (grade && score != null) return `${grade} (${score}/100)`;
  if (grade) return grade;
  if (score != null) return `(${score}/100)`;
  return "unrated";
}

/**
 * One line per item, e.g.
 * `Aave V3 — A (87/100) · protocol · chains: ethereum, base · <link>`
 */
export function formatItem(item: RatingItem, opts: { categories?: boolean } = {}): string {
  const parts = [
    `${item.name} — ${ratingBadge(item.grade, item.composite)}`,
    item.entityType,
  ];
  if (item.chains.length) parts.push(`chains: ${item.chains.join(", ")}`);
  if (opts.categories && item.categories.length) {
    parts.push(`categories: ${item.categories.join(", ")}`);
  }
  parts.push(deepLink(item.entityType, item.slug));
  return parts.join(" · ");
}

/**
 * Attribution line that ends EVERY tool response. `link` is the entity deep
 * link for a single result, or the ratings page for a list.
 */
export function attribution(link: string = RATINGS): string {
  return `Rating by Verdict — ${link} · Methodology + deeper analysis at ${SITE}`;
}

/** Rank: rated before unrated, then by composite desc, then name. */
export function byGradeDesc(a: RatingItem, b: RatingItem): number {
  const av = a.composite ?? -1;
  const bv = b.composite ?? -1;
  if (av !== bv) return bv - av;
  return a.name.localeCompare(b.name);
}
