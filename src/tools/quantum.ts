import { z } from "zod";
import type { QuantumChain, QuantumLeague, VerdictClient } from "../client.js";
import { quantumReadinessLine } from "../format.js";
import { textResult, type ToolResult } from "../respond.js";

// The dedicated tool attributes LayerQu on its own line (plain hyphens).
const LAYERQU_ATTRIB = "Data: LayerQu - https://layerqu.com/dashboard/";

export const quantumReadinessInput = {
  chain: z
    .string()
    .optional()
    .describe("Optional chain slug (e.g. 'ethereum'). Omit for the full league table."),
} as const;

export const quantumReadinessMeta = {
  name: "quantum_readiness",
  title: "Post-quantum readiness (LayerQu)",
  description:
    "Post-quantum cryptographic readiness for blockchains, data by LayerQu. With a chain slug: that chain's QRI (0-100), readiness band, migration stage, and hybrid-signature status. Without a slug: the full league table of 72+ chains, including ones Verdict has not rated. Companion data only - never part of a Verdict grade. Example: quantum_readiness({ chain: 'ethereum' }).",
};

function unavailable(reason?: string): ToolResult {
  const why = reason ? ` (${reason})` : "";
  return textResult(`Quantum readiness is unavailable right now${why}. ${LAYERQU_ATTRIB}`);
}

export async function quantumReadiness(
  client: VerdictClient,
  args: { chain?: string },
): Promise<ToolResult> {
  let data: QuantumChain | QuantumLeague;
  try {
    data = await client.getQuantumReadiness(args.chain);
  } catch {
    // Availability is data: a source/network failure renders as unavailable,
    // never a tool error.
    return unavailable();
  }

  if (!data || data.available === false) {
    return unavailable(data?.reason);
  }

  if (args.chain) {
    const q = data as QuantumChain;
    const head = quantumReadinessLine(q);
    if (!head) return unavailable(q.reason);
    const lines = [head];
    if (q.hybrid) lines.push(`Hybrid signatures: ${q.hybrid}`);
    lines.push(`Danger flag: ${q.danger ? "yes" : "no"}`);
    if (q.ci != null) lines.push(`CI: ${q.ci}`);
    lines.push(LAYERQU_ATTRIB);
    return textResult(lines.join("\n"));
  }

  const league = data as QuantumLeague;
  const rows = league.rows ?? [];
  const header = `Post-quantum readiness league (LayerQu) - ${rows.length} chains`;
  const body = rows.map(
    (r) => `${r.name} - QRI ${r.qri} - Band ${r.band} ${r.band_label} - S${r.stage}`,
  );
  return textResult([header, ...body, LAYERQU_ATTRIB].join("\n"));
}
