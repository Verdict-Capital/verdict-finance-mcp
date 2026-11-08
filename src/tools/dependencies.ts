import { z } from "zod";
import type { EntityType } from "../entities.js";
import type { GraphEdge, GraphMove, GraphNode, VerdictClient } from "../client.js";
import { attribution, deepLink, utcDay } from "../format.js";
import { errorResult, friendlyError, textResult, type ToolResult } from "../respond.js";
import { entityTypeSchema } from "../schema.js";

// Reads the public dependency graph (GET /graph). It prints each link's type,
// criticality and rank drag; never the pull, a percentage or a structural cap.

const MAX_MOVES = 5;
const CRITICALITY = ["critical", "important", "minor"];

export const getDependenciesInput = {
  entity_type: entityTypeSchema.describe(
    "The kind of entity: protocol, chain, token, oracle, vault, organisation, or bridge.",
  ),
  slug: z.string().min(1).describe("The entity's slug, e.g. 'syrupusdt' or 'ethereum'."),
} as const;

export const getDependenciesMeta = {
  name: "get_dependencies",
  title: "What a rating depends on",
  description:
    "What an entity depends on, what depends on it, and its last five grade moves with their causes. Example: get_dependencies({ entity_type: 'vault', slug: 'syrupusdt' })",
};

/** "runs_on" -> "runs on". */
function words(s: string): string {
  return s.replace(/_/g, " ");
}

/** A node's name as shown; a private node is never named. */
function nameOf(node: GraphNode): string {
  return node.private ? `a private ${node.type}` : (node.name ?? node.slug ?? node.id);
}

/** "BBB, 73.48" | "BBB" | "not rated". */
function pair(grade: string | null, composite: number | null): string {
  const parts = [grade, composite].filter((x) => x != null);
  return parts.length ? parts.join(", ") : "not rated";
}

/** The lifecycle flag the graph carries (no date there); matured wins. */
function flag(node: GraphNode): string | null {
  if (node.matured) return "matured";
  if (node.withdrawn) return "withdrawn";
  return null;
}

function headline(node: GraphNode): string {
  const standing = [pair(node.grade, node.composite), flag(node)].filter(Boolean).join(", ");
  let line = `${nameOf(node)} (${node.type}): ${standing}.`;
  if (node.intrinsic_grade != null || node.intrinsic_composite != null) {
    line += ` Standalone: ${pair(node.intrinsic_grade, node.intrinsic_composite)}.`;
  }
  return line;
}

/** One link, named by the node at its other end. */
function linkLine(other: GraphNode, edge: GraphEdge): string {
  const label = other.private
    ? nameOf(other)
    : `${nameOf(other)} (${[other.type, other.grade ?? "not rated", flag(other)].filter(Boolean).join(", ")})`;
  let line = `- ${label}: ${words(edge.type)}, ${edge.criticality}`;
  if (edge.rank_drag > 0) {
    line += `, ${edge.rank_drag} rank${edge.rank_drag === 1 ? "" : "s"} below B`;
  }
  return line;
}

/** Critical, important, minor; then by name. */
function linkLines(links: Array<{ other: GraphNode; edge: GraphEdge }>): string[] {
  const rank = (c: string) => {
    const i = CRITICALITY.indexOf(c);
    return i === -1 ? CRITICALITY.length : i;
  };
  return [...links]
    .sort((a, b) =>
      rank(a.edge.criticality) - rank(b.edge.criticality) ||
      nameOf(a.other).localeCompare(nameOf(b.other)))
    .map(({ other, edge }) => linkLine(other, edge));
}

/** "BBB 72.92" | "BBB" | "not rated". */
function side(grade: string | null, composite: number | null): string {
  const parts = [grade, composite].filter((x) => x != null);
  return parts.length ? parts.join(" ") : "not rated";
}

function moveLine(m: GraphMove): string {
  const c = m.cause;
  const who = c.entity_name ?? c.entity_slug ?? (c.entity_type ? `a private ${c.entity_type}` : null);
  const cause = who ? `${words(c.kind)}: ${who}` : words(c.kind);
  const day = utcDay(m.computed_at) ?? "undated";
  return `- ${day}: ${side(m.prior_grade, m.prior_composite)} to ${side(m.new_grade, m.new_composite)}, ${cause}`;
}

export async function getDependencies(
  client: VerdictClient,
  args: { entity_type: EntityType; slug: string },
): Promise<ToolResult> {
  const { entity_type, slug } = args;

  let graph;
  try {
    graph = await client.getGraph();
  } catch (err) {
    return errorResult(friendlyError(err));
  }

  const nodes = new Map(graph.nodes.map((n) => [n.id, n]));
  const node = nodes.get(`${entity_type}:${slug}`);
  if (!node || node.private) {
    return textResult(`No Verdict entity found for "${slug}" (${entity_type}).\n\n${attribution()}`);
  }

  const out: Array<{ other: GraphNode; edge: GraphEdge }> = [];
  const into: Array<{ other: GraphNode; edge: GraphEdge }> = [];
  for (const edge of graph.edges) {
    if (edge.from === node.id) {
      const other = nodes.get(edge.to);
      if (other) out.push({ other, edge });
    } else if (edge.to === node.id) {
      const other = nodes.get(edge.from);
      if (other) into.push({ other, edge });
    }
  }

  const moves = [...(node.recent_moves ?? [])]
    .sort((a, b) => (Date.parse(b.computed_at ?? "") || 0) - (Date.parse(a.computed_at ?? "") || 0))
    .slice(0, MAX_MOVES);

  const lines = [headline(node)];
  if (out.length) lines.push("Depends on:", ...linkLines(out));
  else lines.push("No dependencies recorded.");
  if (into.length) lines.push("Depended on by:", ...linkLines(into));
  else lines.push("Nothing Verdict rates depends on it.");
  if (moves.length) lines.push("Recent grade moves:", ...moves.map(moveLine));
  else lines.push("No grade moves recorded.");

  return textResult(`${lines.join("\n")}\n\n${attribution(deepLink(entity_type, slug))}`);
}
