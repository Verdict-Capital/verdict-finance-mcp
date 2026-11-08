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
  dragHint: string | null;
  hasUnratedDeps: boolean;
  /** "withdrawn 2026-09-28" or "matured 2026-10-12" for a withdrawn rating. */
  lifecycle?: string | null;
}

/**
 * Per-entity deep link. The ratings page routes a `#{type}-{slug}` hash to the
 * matching entity tab and scrolls to the live ratings section.
 */
export function deepLink(entityType: EntityType, slug: string): string {
  return `${RATINGS}#${entityType}-${slug}`;
}

/** The UTC day (YYYY-MM-DD) of an ISO 8601 time, or null when it does not parse. */
function utcDay(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
}

/**
 * The mark a withdrawn rating carries after its badge (ruling 401). The grade
 * stays: it is Verdict's last grade, kept for the record. A vault whose
 * instrument has expired reads "matured <expiry day>"; anything else withdrawn
 * reads "withdrawn <withdrawal day>".
 */
function lifecycleMark(entityType: EntityType, entity: EntityRecord): string | null {
  if (entity.status !== "withdrawn") return null;
  const expires = entity.expires_at ? Date.parse(entity.expires_at) : NaN;
  if (entityType === "vault" && expires < Date.now()) {
    return `matured ${utcDay(entity.expires_at)}`;
  }
  const day = utcDay(entity.withdrawn_at);
  return day ? `withdrawn ${day}` : "withdrawn";
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
    dragHint: rating?.largest_drag_hint ?? null,
    hasUnratedDeps: rating?.has_unrated_dependencies ?? false,
    lifecycle: lifecycleMark(entityType, entity),
  };
}

/**
 * Extra provenance lines for a single-entity view. The headline shows one
 * public grade; these lines say what dependency drag shaped it.
 */
export function detailLines(item: RatingItem): string[] {
  const lines: string[] = [];
  if (item.dragHint) lines.push(`Dependency drag: ${item.dragHint}`);
  if (item.hasUnratedDeps) lines.push("Note: some dependencies are not yet rated.");
  return lines;
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
 * `Aave V4: A (87/100) · protocol · chains: ethereum, base · <link>`
 */
export function formatItem(item: RatingItem, opts: { categories?: boolean } = {}): string {
  const mark = item.lifecycle ? `, ${item.lifecycle}` : "";
  const parts = [
    `${item.name}: ${ratingBadge(item.grade, item.composite)}${mark}`,
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
  return `Rating by Verdict: ${link}`;
}

/**
 * The LayerQu attribution line every quantum payload carries (data licence
 * clauses 3.2 and 5.2): source, link, the as-of time and, when a refresh
 * failed, the stale marking. Plain hyphens only.
 */
export function layerquAttribution(q?: { as_of?: string; stale?: boolean }): string {
  let line = "Data: LayerQu - https://layerqu.com/dashboard/";
  if (q?.as_of) line += ` - as of ${q.as_of}`;
  if (q?.stale) line += " - stale: the last refresh failed, this is the most recent copy";
  return line;
}

/**
 * The one-line quantum-readiness summary shared by get_rating (chains) and the
 * quantum_readiness tool's per-chain detail. Returns null when the source has
 * no assessment for the chain (available:false or missing score fields), so
 * callers append nothing. Plain hyphens only.
 */
export function quantumReadinessLine(q: {
  available?: boolean;
  qri?: number | null;
  band?: number | null;
  band_label?: string | null;
  stage?: number | null;
}): string | null {
  if (!q || q.available === false) return null;
  if (q.qri == null || q.band == null || q.stage == null) return null;
  return `Quantum readiness (LayerQu): QRI ${q.qri}/100 - Band ${q.band} ${q.band_label ?? ""} - Stage S${q.stage}`;
}

/** Rank: rated before unrated, then by composite desc, then name. */
export function byGradeDesc(a: RatingItem, b: RatingItem): number {
  const av = a.composite ?? -1;
  const bv = b.composite ?? -1;
  if (av !== bv) return bv - av;
  return a.name.localeCompare(b.name);
}
