// Grades live on a separate scorecards endpoint, so a list of entities must be
// enriched with one scorecard fetch each (N+1). We bound concurrency and treat
// a per-item rating failure as "unrated" rather than failing the whole tool —
// one flaky/missing scorecard must not sink a whole search.

import type { EntityType } from "./entities.js";
import type { EntityRecord, VerdictClient } from "./client.js";
import { toRatingItem, type RatingItem } from "./format.js";

const CONCURRENCY = 6;

export async function enrichWithRatings(
  client: VerdictClient,
  entityType: EntityType,
  entities: EntityRecord[],
): Promise<RatingItem[]> {
  const out: RatingItem[] = new Array(entities.length);
  let cursor = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const i = cursor++;
      if (i >= entities.length) return;
      const entity = entities[i];
      let rating = null;
      try {
        rating = await client.getLatestRating(entityType, entity.id);
      } catch {
        // Missing/flaky scorecard -> render as unrated.
        rating = null;
      }
      out[i] = toRatingItem(entityType, entity, rating);
    }
  }

  const workers = Array.from({ length: Math.min(CONCURRENCY, entities.length) }, worker);
  await Promise.all(workers);
  return out;
}
