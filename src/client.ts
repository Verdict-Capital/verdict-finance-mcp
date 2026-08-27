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

export type VerdictErrorKind =
  | "not_found"
  | "rate_limit"
  | "network"
  | "server"
  | "unauthorized"
  | "unknown";

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

/** The public scorecard fields (domain breakdowns come from getDomains). */
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

/** One hack incident from the public feed, at whatever tier it has reached. */
export interface Incident {
  incident_id: string;
  protocol_name: string;
  /** Verdict slug, null when the incident did not match a rated protocol. */
  slug: string | null;
  matched_protocol: boolean;
  status: string;
  exploit_class: string | null;
  loss_estimate_usd: number | null;
  chain: string | null;
  confidence_bps: number;
  source_count: number;
  sources: unknown[] | null;
  detected_at: string;
  first_seen_at: string;
  resolved_at: string | null;
  resolution: string | null;
}

export type IncidentTier = "rumored" | "corroborated" | "confirmed";

export interface IncidentParams {
  /** ISO datetime; only incidents detected after it. */
  since?: string;
  /** Exact Verdict slug of a rated protocol. */
  slug?: string;
  /**
   * Lowest confidence tier to return. Omit to inherit the server's default of
   * confirmed: the parameter is only ever sent when a caller asks for it, so
   * the default lives in one place rather than being mirrored here.
   */
  min_status?: IncidentTier;
  limit?: number;
}

export interface IncidentPage {
  items: Incident[];
  total: number;
}

/** The published methodology contract (anonymous route, no key needed). */
export interface MethodologyEntityType {
  type: string;
  questions: number;
  domains: string[];
  domain_count: number;
}

export interface MethodologyGrade {
  grade: string;
  min_score: number;
  description: string;
}

export interface Methodology {
  name?: string;
  version?: string;
  total_questions?: number;
  entity_types?: MethodologyEntityType[];
  grade_scale?: MethodologyGrade[];
  grade_rounding?: string;
  attribution?: string;
  methodology_url?: string;
}

/**
 * Per-domain breakdown for one entity. This is a tier-gated route: it answers
 * only for a caller carrying an API key of a tier that includes it. Fields are
 * passed through as served, so a richer payload stays readable.
 */
export interface DomainBreakdown {
  entity?: { slug?: string; name?: string };
  composite_score?: number | null;
  grade?: string | null;
  letter_grade?: string | null;
  intrinsic_composite_score?: number | null;
  intrinsic_letter_grade?: string | null;
  largest_drag_hint?: string | null;
  has_unrated_dependencies?: boolean;
  domain_scores?: Record<string, number> | null;
  last_rated_at?: string | null;
}

/**
 * A coverage request, as the public contacts endpoint takes it. `request_type`
 * is "rating-request" for coverage: it is the same intent the "Get rated" form
 * on verdict.finance submits, so these land in the same queue.
 */
export interface ContactSubmission {
  protocol_name: string;
  contact_email: string;
  request_type: string;
  message: string;
}

/** The receipt the contacts endpoint returns on a successful submission. */
export interface ContactReceipt {
  id?: string;
  protocol_name?: string;
  contact_email?: string;
  request_type?: string;
  status?: string;
  created_at?: string;
}

export interface VerdictClient {
  listEntities(type: EntityType, params?: ListParams): Promise<EntityRecord[]>;
  getEntity(type: EntityType, identifier: string): Promise<EntityRecord>;
  /** Latest published scorecard for an entity, or null if it has none yet. */
  getLatestRating(type: EntityType, entityId: string): Promise<Rating | null>;
  /** LayerQu quantum readiness: per-chain with a slug, else the league table. */
  getQuantumReadiness(chainSlug?: string): Promise<QuantumReadiness>;
  /** Confirmed hack incidents, newest first. */
  listIncidents(params?: IncidentParams): Promise<IncidentPage>;
  /** The published methodology contract. Anonymous. */
  getMethodology(): Promise<Methodology>;
  /** Per-domain breakdown for one entity. Needs a key (tier-gated route). */
  getDomains(type: EntityType, slug: string): Promise<DomainBreakdown>;
  /**
   * Whether this client was given an API key. Tools that front a tier-gated
   * route ask FIRST, so a keyless caller gets an answer instead of a 401.
   */
  hasApiKey(): boolean;
  /** Submit a coverage request. Anonymous route, IP rate limited. */
  submitContactRequest(body: ContactSubmission): Promise<ContactReceipt>;
}

export class HttpVerdictClient implements VerdictClient {
  private readonly base: string;
  private readonly timeoutMs: number;
  /**
   * Bring-your-own-key. Absent (the default) the client is exactly as keyless
   * as it has always been; present it authenticates every call, which unlocks
   * the tier-gated routes for that key's tier. The value is never logged,
   * echoed, or rendered into any tool output.
   */
  private readonly apiKey: string | undefined;

  constructor(opts: { base?: string; timeoutMs?: number; apiKey?: string } = {}) {
    this.base = (opts.base ?? process.env.VERDICT_API_BASE ?? DEFAULT_BASE).replace(/\/+$/, "");
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const key = (opts.apiKey ?? process.env.VERDICT_API_KEY ?? "").trim();
    this.apiKey = key.length > 0 ? key : undefined;
  }

  hasApiKey(): boolean {
    return this.apiKey !== undefined;
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

  async listIncidents(params: IncidentParams = {}): Promise<IncidentPage> {
    // URLSearchParams percent-encodes for us. That matters most for `since`:
    // an ISO timestamp ending "+00:00" pasted raw into a query string has its
    // "+" decoded as a space and the API answers 422. Callers never see that.
    const qs = new URLSearchParams();
    if (params.since) qs.set("since", params.since);
    if (params.slug) qs.set("slug", params.slug);
    if (params.min_status) qs.set("min_status", params.min_status);
    qs.set("limit", String(params.limit ?? 25));
    const body = await this.get<Partial<IncidentPage>>(`/incidents?${qs.toString()}`);
    return { items: body.items ?? [], total: body.total ?? 0 };
  }

  async getMethodology(): Promise<Methodology> {
    return this.get<Methodology>("/methodology");
  }

  async getDomains(type: EntityType, slug: string): Promise<DomainBreakdown> {
    return this.get<DomainBreakdown>(
      `/${pluralOf(type)}/${encodeURIComponent(slug)}/domains`,
    );
  }

  /**
   * Request headers. Keyless this is byte-for-byte what it has always been;
   * with a key it gains the Bearer line and nothing else.
   */
  private headers(): Record<string, string> {
    const headers: Record<string, string> = { accept: "application/json" };
    if (this.apiKey) headers.authorization = `Bearer ${this.apiKey}`;
    return headers;
  }

  async submitContactRequest(body: ContactSubmission): Promise<ContactReceipt> {
    return this.request<ContactReceipt>("/contacts", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { ...this.headers(), "content-type": "application/json" },
    });
  }

  private async get<T>(path: string): Promise<T> {
    return this.request<T>(path, {});
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const url = `${this.base}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let res: Response;
    try {
      res = await fetch(url, {
        signal: controller.signal,
        headers: this.headers(),
        ...init,
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
    if (res.status === 401 || res.status === 403) {
      // Only reachable on a tier-gated route: either no key travelled, or the
      // key's tier does not include it. The key itself is never in the message.
      throw new VerdictError("unauthorized", `${res.status} for ${path}`);
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
