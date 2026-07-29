// The 7 Verdict entity types. The tool `entity_type` arg is the SINGULAR form;
// every REST route uses the plural (`protocol` -> `/protocols`). The pluralise
// map is explicit (not `+ "s"`) so a future irregular plural is a one-line fix.

export const ENTITY_TYPES = [
  "protocol",
  "chain",
  "token",
  "oracle",
  "vault",
  "organisation",
  "bridge",
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];

const PLURAL: Record<EntityType, string> = {
  protocol: "protocols",
  chain: "chains",
  token: "tokens",
  oracle: "oracles",
  vault: "vaults",
  organisation: "organisations",
  bridge: "bridges",
};

export function isEntityType(value: string): value is EntityType {
  return (ENTITY_TYPES as readonly string[]).includes(value);
}

/** Plural route segment for an entity type, e.g. "protocol" -> "protocols". */
export function pluralOf(type: EntityType): string {
  return PLURAL[type];
}
