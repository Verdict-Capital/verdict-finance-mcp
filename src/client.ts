// Thin, anonymous (keyless) HTTPS client over the live Verdict read API.
//
// Data path (grounded against the v0.2 backend):
//   - entity list/detail  GET /{type}s , GET /{type}s/{identifier}
//       -> name, slug, chains, categories   (NO grade here)
//   - rating (grade)      GET /{type}s/{id}/scorecards
//       -> { items: [{ letter_grade, composite_score, ... }], total }
//       anonymous callers get ONLY the latest published scorecard (or []).
// So a full rating = entity metadata + its latest scorecard. We resolve every
// entity to its UUID first, then fetch scorecards by id (uniform across all 7 —
// some scorecard routes accept a slug, others require the id).

import { pluralOf, type EntityType } from "./entities.js";

const DEFAULT_BASE = "https://api.verdict.finance/api/v1";
const DEFAULT_TIMEOUT_MS = 10_000;

export type VerdictErrorKind = "not_found" | "rate_limit" | "network" | "server" | "unknown";

export class VerdictError extends Error {
  constructor(
    readonly kind: VerdictErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "VerdictError";
  }
}

/** A chain reference as embedded in entity responses (ChainBrief). */
interface ChainBrief {
  slug?: string | null;
  name?: string | null;
}

/** The public fields of an entity list/detail record we care about. */
export interface EntityRecord {
  id: string;
  name: string;
  slug: string;
  chains?: ChainBrief[];
  categories?: string[];
}

/** The free-tier scorecard fields (domain breakdowns are stripped for anon). */
export interface Rating {
  letter_grade: string | null;
  composite_score: number | null;
  largest_drag_hint: string | null;
  has_unrated_dependencies: boolean;
}

export interface ListParams {
  search?: string;
  category?: string;
  chain?: string;
  limit?: number;
}

/** One row of the LayerQu post-quantum readiness league table. */
export interface QuantumRow {
  slug: string;
  name: string;
  profile?: string;
  stage: number;
  qri: number;
  band: number;
  band_label: string;
  hybrid?: string;
  danger?: boolean;
  ci?: number | null;
  matched_chain_slug?: string | null;
}

/** Per-chain quantum-readiness payload (availability is data, not an error). */
export interface QuantumChain {
  available: boolean;
  reason?: string;
  source?: string;
  source_url?: string;
  chain_slug?: string;
  qri?: number;
  band?: number;
  band_label?: string;
  stage?: number;
  hybrid?: string;
  danger?: boolean;
  ci?: number | null;
}

/** Full league payload. */
export interface QuantumLeague {
  available: boolean;
  reason?: string;
  source?: string;
  source_url?: string;
  rows?: QuantumRow[];
  rows_skipped?: number;
}

export type QuantumReadiness = QuantumChain | QuantumLeague;

export interface VerdictClient {
  listEntities(type: EntityType, params?: ListParams): Promise<EntityRecord[]>;
  getEntity(type: EntityType, identifier: string): Promise<EntityRecord>;
  /** Latest published scorecard for an entity, or null if it has none yet. */
  getLatestRating(type: EntityType, entityId: string): Promise<Rating | null>;
  /** LayerQu quantum readiness: per-chain with a slug, else the league table. */
  getQuantumReadiness(chainSlug?: string): Promise<QuantumReadiness>;
}

export class HttpVerdictClient implements VerdictClient {
  private readonly base: string;
  private readonly timeoutMs: number;

  constructor(opts: { base?: string; timeoutMs?: number } = {}) {
    this.base = (opts.base ?? process.env.VERDICT_API_BASE ?? DEFAULT_BASE).replace(/\/+$/, "");
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async listEntities(type: EntityType, params: ListParams = {}): Promise<EntityRecord[]> {
    const qs = new URLSearchParams();
    if (params.search) qs.set("search", params.search);
    if (params.category) qs.set("category", params.category.toLowerCase());
    if (params.chain) qs.set("chain", params.chain);
    qs.set("limit", String(params.limit ?? 25));
    const body = await this.get<{ items?: EntityRecord[] }>(`/${pluralOf(type)}?${qs.toString()}`);
    return body.items ?? [];
  }

  async getEntity(type: EntityType, identifier: string): Promise<EntityRecord> {
    return this.get<EntityRecord>(`/${pluralOf(type)}/${encodeURIComponent(identifier)}`);
  }

  async getLatestRating(type: EntityType, entityId: string): Promise<Rating | null> {
    const body = await this.get<{ items?: Rating[] }>(
      `/${pluralOf(type)}/${encodeURIComponent(entityId)}/scorecards`,
    );
    const latest = body.items?.[0];
    if (!latest) return null;
    return {
      letter_grade: latest.letter_grade ?? null,
      composite_score: latest.composite_score ?? null,
      largest_drag_hint: latest.largest_drag_hint ?? null,
      has_unrated_dependencies: latest.has_unrated_dependencies ?? false,
    };
  }

  async getQuantumReadiness(chainSlug?: string): Promise<QuantumReadiness> {
    const path = chainSlug
      ? `/chains/${encodeURIComponent(chainSlug)}/quantum-readiness`
      : "/quantum-readiness";
    return this.get<QuantumReadiness>(path);
  }

  private async get<T>(path: string): Promise<T> {
    const url = `${this.base}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let res: Response;
    try {
      res = await fetch(url, {
        signal: controller.signal,
        headers: { accept: "application/json" },
      });
    } catch {
      // Abort (timeout) or DNS/connection failure — indistinguishable and both
      // "couldn't reach Verdict" to the user.
      throw new VerdictError("network", `Could not reach Verdict at ${url}`);
    } finally {
      clearTimeout(timer);
    }

    if (res.status === 404) {
      throw new VerdictError("not_found", `404 for ${path}`);
    }
    if (res.status === 429) {
      throw new VerdictError("rate_limit", "429 rate limited");
    }
    if (res.status >= 500) {
      throw new VerdictError("server", `Verdict returned ${res.status}`);
    }
    if (!res.ok) {
      throw new VerdictError("unknown", `Verdict returned ${res.status}`);
    }

    try {
      return (await res.json()) as T;
    } catch {
      throw new VerdictError("unknown", "Verdict returned a malformed response");
    }
  }
}
