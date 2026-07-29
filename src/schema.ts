import { z } from "zod";
import { ENTITY_TYPES, type EntityType } from "./entities.js";

/** Zod enum over the 7 singular entity types (bad values rejected pre-handler). */
export const entityTypeSchema = z.enum(
  ENTITY_TYPES as unknown as [EntityType, ...EntityType[]],
);
