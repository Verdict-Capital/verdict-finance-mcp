import { describe, it, expect } from "vitest";
import { FakeClient } from "./helpers.js";
import { getDependencies, getDependenciesMeta } from "../src/tools/dependencies.js";
import type { Graph, GraphEdge, GraphMove, GraphNode } from "../src/client.js";

function text(r: { content: Array<{ text?: string }> }): string {
  return r.content.map((c) => c.text ?? "").join("\n");
}

// Shapes follow GET /api/v1/graph (v0.2 graph_service.build_graph); the extra
// fields a live edge carries (pull, structural_cap) ride along so the test can
// prove they never reach the output.
function node(over: Partial<GraphNode> & { id: string; type: string; name: string | null }): GraphNode {
  return {
    slug: over.id.split(":")[1], rated: true, grade: null, composite: null,
    intrinsic_grade: null, intrinsic_composite: null,
    withdrawn: false, matured: false, private: false, recent_moves: [], ...over,
  };
}

function edge(from: string, to: string, type: string, criticality: string, rank_drag = 0): GraphEdge {
  return { from, to, type, criticality, rank_drag, pull: 0.4375, structural_cap: false, unrated: false, matured: false } as GraphEdge;
}

function move(computed_at: string, prior: [string, number], next: [string, number], cause: GraphMove["cause"]): GraphMove {
  return {
    computed_at, prior_grade: prior[0], prior_composite: prior[1], new_grade: next[0], new_composite: next[1], cause,
  };
}

const SYRUP_MOVES: GraphMove[] = [
  // Served out of order on purpose, six of them: the tool sorts and keeps five.
  move("2026-09-10T12:00:00+00:00", ["BBB", 74.01], ["BB", 69.52], { kind: "holding_changed" }),
  move("2026-10-20T14:05:50.538279+00:00", ["BBB", 72.92], ["BBB", 73.48],
    { kind: "edge_added", entity_type: "chain", entity_slug: "plasma", entity_name: "Plasma" }),
  move("2026-07-01T00:00:00+00:00", ["A", 80.5], ["BBB", 74.4],
    { kind: "edge_added", entity_type: "chain", entity_slug: "ink", entity_name: "Ink" }),
  move("2026-10-01T09:00:00+00:00", ["BBB", 73.15], ["BBB", 72.92], { kind: "dependency_published", entity_type: "oracle" }),
  move("2026-08-01T00:00:00+00:00", ["BBB", 74.4], ["BBB", 74.01], { kind: "edge_removed", entity_type: "bridge", entity_slug: "old-bridge" }),
  move("2026-09-28T21:03:00+00:00", ["BB", 69.52], ["BBB", 73.15],
    { kind: "dependency_withdrawn", entity_type: "oracle", entity_slug: "eoracle", entity_name: "eOracle" }),
];

function syrupGraph(): Graph {
  return {
    nodes: [
      node({ id: "vault:syrupusdt", type: "vault", name: "syrupUSDT", grade: "BBB", composite: 73.48,
        intrinsic_grade: "BBB", intrinsic_composite: 73.66, recent_moves: SYRUP_MOVES }),
      node({ id: "chain:ethereum", type: "chain", name: "Ethereum", grade: "A", composite: 81.2,
        intrinsic_grade: "A", intrinsic_composite: 81.2 }),
      node({ id: "chain:plasma", type: "chain", name: "Plasma", grade: "CCC", composite: 41.3 }),
      node({ id: "chain:ink", type: "chain", name: "Ink", grade: "CC", composite: 33.1 }),
      node({ id: "token:usdt-ethereum", type: "token", name: "USD Tether", rated: false }),
      node({ id: "protocol:maple", type: "protocol", name: "Maple", rated: false }),
      node({ id: "oracle:eoracle", type: "oracle", name: "eOracle", grade: "B", composite: 50.37,
        intrinsic_grade: "B", intrinsic_composite: 50.37, withdrawn: true }),
      node({ id: "vault:syrupusdc-sep", type: "vault", name: "syrupUSDC Sep", grade: "BBB", composite: 74,
        withdrawn: true, matured: true }),
      node({ id: "oracle:private-1a2b3c4d", type: "oracle", name: null, slug: null, rated: false, private: true }),
      node({ id: "vault:alpha-usd", type: "vault", name: "Alpha USD", grade: "BBB", composite: 71 }),
      node({ id: "vault:meta-usd", type: "vault", name: "Meta USD", grade: "A", composite: 82 }),
      node({ id: "chain:solana", type: "chain", name: "Solana", grade: "A", composite: 80 }),
    ],
    edges: [
      edge("vault:syrupusdt", "chain:plasma", "runs_on", "important", 1),
      edge("vault:syrupusdt", "oracle:eoracle", "priced_by", "minor"),
      edge("vault:syrupusdt", "chain:ethereum", "runs_on", "critical"),
      edge("vault:syrupusdt", "vault:syrupusdc-sep", "holds", "minor"),
      edge("vault:syrupusdt", "chain:ink", "runs_on", "minor", 2),
      edge("vault:syrupusdt", "token:usdt-ethereum", "holds", "critical"),
      edge("vault:syrupusdt", "oracle:private-1a2b3c4d", "priced_by", "minor"),
      edge("vault:syrupusdt", "protocol:maple", "allocates_to", "important"),
      edge("vault:meta-usd", "vault:syrupusdt", "allocates_to", "important"),
      edge("vault:alpha-usd", "vault:syrupusdt", "holds", "critical"),
      edge("vault:alpha-usd", "chain:ethereum", "runs_on", "critical"),
    ],
  };
}

describe("get_dependencies", () => {
  it("prints both directions and the last five moves, then the attribution line", async () => {
    const c = new FakeClient();
    c.graph = syrupGraph();
    const r = await getDependencies(c, { entity_type: "vault", slug: "syrupusdt" });
    expect(r.isError).toBeFalsy();
    expect(text(r)).toBe([
      "syrupUSDT (vault): BBB, 73.48. Standalone: BBB, 73.66.",
      "Depends on:",
      "- Ethereum (chain, A): runs on, critical",
      "- USD Tether (token, not rated): holds, critical",
      "- Maple (protocol, not rated): allocates to, important",
      "- Plasma (chain, CCC): runs on, important, 1 rank below B",
      "- a private oracle: priced by, minor",
      "- eOracle (oracle, B, withdrawn): priced by, minor",
      "- Ink (chain, CC): runs on, minor, 2 ranks below B",
      "- syrupUSDC Sep (vault, BBB, matured): holds, minor",
      "Depended on by:",
      "- Alpha USD (vault, BBB): holds, critical",
      "- Meta USD (vault, A): allocates to, important",
      "Recent grade moves:",
      "- 2026-10-20: BBB 72.92 to BBB 73.48, edge added: Plasma",
      "- 2026-10-01: BBB 73.15 to BBB 72.92, dependency published: a private oracle",
      "- 2026-09-28: BB 69.52 to BBB 73.15, dependency withdrawn: eOracle",
      "- 2026-09-10: BBB 74.01 to BB 69.52, holding changed",
      "- 2026-08-01: BBB 74.4 to BBB 74.01, edge removed: old-bridge",
      "",
      "Rating by Verdict: https://www.verdict.finance/products/ratings#vault-syrupusdt",
    ].join("\n"));
  });

  it("puts the rank note on a Depends on line only, never on a Depended on by line", async () => {
    // One dragged edge in each list. Plasma's own drag on syrupUSDT describes
    // Plasma, the entity looked up, so the syrupUSDT line carries no note.
    const c = new FakeClient();
    c.graph = {
      nodes: [
        node({ id: "chain:plasma", type: "chain", name: "Plasma", grade: "CCC", composite: 41.3 }),
        node({ id: "bridge:weak-bridge", type: "bridge", name: "Weak Bridge", grade: "CCC", composite: 40.2 }),
        node({ id: "vault:syrupusdt", type: "vault", name: "syrupUSDT", grade: "BBB", composite: 73.48 }),
      ],
      edges: [
        edge("chain:plasma", "bridge:weak-bridge", "bridges_via", "important", 1),
        edge("vault:syrupusdt", "chain:plasma", "runs_on", "important", 1),
      ],
    };
    const t = text(await getDependencies(c, { entity_type: "chain", slug: "plasma" }));
    expect(t).toContain("Depends on:\n- Weak Bridge (bridge, CCC): bridges via, important, 1 rank below B\n");
    expect(t).toContain("Depended on by:\n- syrupUSDT (vault, BBB): runs on, important\n");
    const dependants = t.slice(t.indexOf("Depended on by:"));
    expect(dependants).not.toContain("rank below B");
  });

  it("marks a withdrawn node without a date, since the graph has none", async () => {
    const c = new FakeClient();
    c.graph = syrupGraph();
    const t = text(await getDependencies(c, { entity_type: "vault", slug: "syrupusdt" }));
    expect(t).toContain("(oracle, B, withdrawn)");
    expect(t).not.toMatch(/withdrawn \d{4}/);
  });

  it("never prints the pull, a percentage or a structural cap", async () => {
    const c = new FakeClient();
    c.graph = syrupGraph();
    const t = text(await getDependencies(c, { entity_type: "vault", slug: "syrupusdt" }));
    expect(t).not.toContain("0.4375");
    expect(t).not.toContain("%");
    expect(t).not.toMatch(/pull|structural|cap/i);
  });

  it("names no private node", async () => {
    const c = new FakeClient();
    c.graph = syrupGraph();
    const t = text(await getDependencies(c, { entity_type: "vault", slug: "syrupusdt" }));
    expect(t).not.toContain("private-1a2b3c4d");
    expect(t).not.toContain("a private oracle (");
  });

  it("heads a withdrawn entity with its last grade, flagged, and says what is empty", async () => {
    const c = new FakeClient();
    c.graph = syrupGraph();
    const r = await getDependencies(c, { entity_type: "oracle", slug: "eoracle" });
    expect(text(r)).toBe([
      "eOracle (oracle): B, 50.37, withdrawn. Standalone: B, 50.37.",
      "No dependencies recorded.",
      "Depended on by:",
      "- syrupUSDT (vault, BBB): priced by, minor",
      "No grade moves recorded.",
      "",
      "Rating by Verdict: https://www.verdict.finance/products/ratings#oracle-eoracle",
    ].join("\n"));
  });

  it("prints a matured node as matured, the flag that wins over withdrawn", async () => {
    const c = new FakeClient();
    c.graph = syrupGraph();
    const t = text(await getDependencies(c, { entity_type: "vault", slug: "syrupusdc-sep" }));
    expect(t.split("\n")[0]).toBe("syrupUSDC Sep (vault): BBB, 74, matured.");
  });

  it("reads an unrated entity that only appears as a dependency", async () => {
    const c = new FakeClient();
    c.graph = syrupGraph();
    const t = text(await getDependencies(c, { entity_type: "token", slug: "usdt-ethereum" }));
    expect(t).toContain("USD Tether (token): not rated.\nNo dependencies recorded.\nDepended on by:\n- syrupUSDT (vault, BBB): holds, critical");
  });

  it("says plainly when nothing links to it and it has never moved", async () => {
    const c = new FakeClient();
    c.graph = syrupGraph();
    const r = await getDependencies(c, { entity_type: "chain", slug: "solana" });
    expect(text(r)).toBe([
      "Solana (chain): A, 80.",
      "No dependencies recorded.",
      "Nothing Verdict rates depends on it.",
      "No grade moves recorded.",
      "",
      "Rating by Verdict: https://www.verdict.finance/products/ratings#chain-solana",
    ].join("\n"));
  });

  it("dates a move by its UTC day", async () => {
    const c = new FakeClient();
    c.graph = {
      nodes: [node({ id: "chain:solana", type: "chain", name: "Solana", grade: "A", composite: 80, recent_moves: [
        move("2026-10-20T23:30:00-05:00", ["A", 79.5], ["A", 80], { kind: "edge_added", entity_type: "bridge", entity_name: "Wormhole" }),
      ] })],
      edges: [],
    };
    const t = text(await getDependencies(c, { entity_type: "chain", slug: "solana" }));
    expect(t).toContain("- 2026-10-21: A 79.5 to A 80, edge added: Wormhole");
  });

  it("answers an unknown entity with a plain not-found line and the attribution line", async () => {
    const c = new FakeClient();
    c.graph = syrupGraph();
    const r = await getDependencies(c, { entity_type: "vault", slug: "ghost" });
    expect(r.isError).toBeFalsy();
    expect(text(r)).toBe(
      'No Verdict entity found for "ghost" (vault).\n\nRating by Verdict: https://www.verdict.finance/products/ratings',
    );
  });

  it("matches the type as well as the slug", async () => {
    const c = new FakeClient();
    c.graph = syrupGraph();
    const t = text(await getDependencies(c, { entity_type: "chain", slug: "syrupusdt" }));
    expect(t).toContain('No Verdict entity found for "syrupusdt" (chain).');
  });

  it("does not reveal a private node looked up by its ghost id", async () => {
    const c = new FakeClient();
    c.graph = syrupGraph();
    const t = text(await getDependencies(c, { entity_type: "oracle", slug: "private-1a2b3c4d" }));
    expect(t).toContain('No Verdict entity found for "private-1a2b3c4d" (oracle).');
  });

  it("reads the graph once and nothing else", async () => {
    const c = new FakeClient();
    c.graph = syrupGraph();
    await getDependencies(c, { entity_type: "vault", slug: "syrupusdt" });
    expect(c.calls.graph).toBe(1);
    expect(c.calls.list + c.calls.get + c.calls.rating + c.calls.domains).toBe(0);
  });

  it("maps a rate limit to the friendly reply (error result)", async () => {
    const c = new FakeClient();
    c.throwOn.graph = "rate_limit";
    const r = await getDependencies(c, { entity_type: "vault", slug: "syrupusdt" });
    expect(r.isError).toBe(true);
    expect(text(r)).toBe("Verdict's rate limit was reached; try again shortly.");
  });

  it("maps a network failure to the friendly reply", async () => {
    const c = new FakeClient();
    c.throwOn.graph = "network";
    const r = await getDependencies(c, { entity_type: "vault", slug: "syrupusdt" });
    expect(r.isError).toBe(true);
    expect(text(r)).toBe("Couldn't reach Verdict right now; try again.");
  });
});

describe("get_dependencies description", () => {
  it("ends in the worked example", () => {
    expect(getDependenciesMeta.description).toBe(
      "What an entity depends on, what depends on it, and its last five grade moves with their causes. Example: get_dependencies({ entity_type: 'vault', slug: 'syrupusdt' })",
    );
  });
});
