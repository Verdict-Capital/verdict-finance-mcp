import { VerdictError, type EntityRecord, type Rating, type VerdictClient, type ListParams } from "../src/client.js";
import type { EntityType } from "../src/entities.js";

type Kind = "not_found" | "rate_limit" | "network" | "server" | "unknown";

/**
 * In-memory VerdictClient for unit tests. Seed entities + ratings; optionally
 * force a VerdictError on a given method.
 */
export class FakeClient implements VerdictClient {
  entities: Partial<Record<EntityType, EntityRecord[]>> = {};
  ratings: Record<string, Rating | null> = {};
  throwOn: Partial<Record<"list" | "get" | "rating", Kind>> = {};
  calls = { list: 0, get: 0, rating: 0 };
  lastListParams: ListParams | undefined;

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
}

export function entity(over: Partial<EntityRecord> & { id: string; name: string; slug: string }): EntityRecord {
  return { chains: [], categories: [], ...over };
}
