import { VerdictError, type ContactReceipt, type ContactSubmission, type DomainBreakdown, type EntityRecord, type IncidentPage, type IncidentParams, type Methodology, type QuantumReadiness, type Rating, type VerdictClient, type ListParams } from "../src/client.js";
import type { EntityType } from "../src/entities.js";

type Kind = "not_found" | "rate_limit" | "network" | "server" | "unauthorized" | "unknown";

/**
 * In-memory VerdictClient for unit tests. Seed entities + ratings; optionally
 * force a VerdictError on a given method.
 */
export class FakeClient implements VerdictClient {
  entities: Partial<Record<EntityType, EntityRecord[]>> = {};
  ratings: Record<string, Rating | null> = {};
  quantum: QuantumReadiness = { available: false };
  incidents: IncidentPage = { items: [], total: 0 };
  methodology: Methodology = {};
  domains: DomainBreakdown = {};
  contactReceipt: ContactReceipt = { id: "contact-1", status: "new" };
  /** Whether this fake is standing in for a keyed client. */
  apiKey = false;
  throwOn: Partial<
    Record<
      | "list"
      | "get"
      | "rating"
      | "quantum"
      | "incidents"
      | "methodology"
      | "domains"
      | "contact",
      Kind
    >
  > = {};
  calls = {
    list: 0, get: 0, rating: 0, quantum: 0, incidents: 0,
    methodology: 0, domains: 0, contact: 0,
  };
  lastListParams: ListParams | undefined;
  lastIncidentParams: IncidentParams | undefined;
  lastDomainsArgs: { type: EntityType; slug: string } | undefined;
  lastContactSubmission: ContactSubmission | undefined;

  hasApiKey(): boolean {
    return this.apiKey;
  }

  async getMethodology(): Promise<Methodology> {
    this.calls.methodology++;
    if (this.throwOn.methodology) throw new VerdictError(this.throwOn.methodology, "forced");
    return this.methodology;
  }

  async getDomains(type: EntityType, slug: string): Promise<DomainBreakdown> {
    this.calls.domains++;
    this.lastDomainsArgs = { type, slug };
    if (this.throwOn.domains) throw new VerdictError(this.throwOn.domains, "forced");
    return this.domains;
  }

  async submitContactRequest(body: ContactSubmission): Promise<ContactReceipt> {
    this.calls.contact++;
    this.lastContactSubmission = body;
    if (this.throwOn.contact) throw new VerdictError(this.throwOn.contact, "forced");
    return this.contactReceipt;
  }

  async listEntities(type: EntityType, params: ListParams = {}): Promise<EntityRecord[]> {
    this.calls.list++;
    this.lastListParams = params;
    if (this.throwOn.list) throw new VerdictError(this.throwOn.list, "forced");
    let items = this.entities[type] ?? [];
    if (params.search) {
      const q = params.search.toLowerCase();
      items = items.filter((e) => e.name.toLowerCase().includes(q) || e.slug.includes(q));
    }
    return items.slice(0, params.limit ?? 25);
  }

  async getEntity(type: EntityType, identifier: string): Promise<EntityRecord> {
    this.calls.get++;
    if (this.throwOn.get) throw new VerdictError(this.throwOn.get, "forced");
    const found = (this.entities[type] ?? []).find(
      (e) => e.slug === identifier || e.id === identifier,
    );
    if (!found) throw new VerdictError("not_found", "no such entity");
    return found;
  }

  async getLatestRating(_type: EntityType, entityId: string): Promise<Rating | null> {
    this.calls.rating++;
    if (this.throwOn.rating) throw new VerdictError(this.throwOn.rating, "forced");
    return this.ratings[entityId] ?? null;
  }

  async getQuantumReadiness(_chainSlug?: string): Promise<QuantumReadiness> {
    this.calls.quantum++;
    if (this.throwOn.quantum) throw new VerdictError(this.throwOn.quantum, "forced");
    return this.quantum;
  }

  async listIncidents(params: IncidentParams = {}): Promise<IncidentPage> {
    this.calls.incidents++;
    this.lastIncidentParams = params;
    if (this.throwOn.incidents) throw new VerdictError(this.throwOn.incidents, "forced");
    return this.incidents;
  }
}

export function entity(over: Partial<EntityRecord> & { id: string; name: string; slug: string }): EntityRecord {
  return { chains: [], categories: [], ...over };
}
