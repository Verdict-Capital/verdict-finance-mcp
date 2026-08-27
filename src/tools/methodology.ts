import type { Methodology, VerdictClient } from "../client.js";
import { attribution } from "../format.js";
import { errorResult, friendlyError, textResult, type ToolResult } from "../respond.js";

export const getMethodologyInput = {} as const;

export const getMethodologyMeta = {
  name: "get_methodology",
  title: "How Verdict scores",
  description:
    "The published Verdict ratings methodology: how many testable criteria each entity type is scored on, which domains those criteria sit in, and the AAA to D grade scale with the composite-score band each grade needs. Read this to explain or sanity-check a grade rather than guessing at what it measures. No arguments, no API key. Example: get_methodology({}).",
};

function renderEntityTypes(m: Methodology): string[] {
  return (m.entity_types ?? []).map((e) => {
    const bits = [`${e.type} - ${e.questions} questions`];
    if (e.domain_count != null) bits.push(`${e.domain_count} domains`);
    if (e.domains?.length) bits.push(e.domains.join(", "));
    return bits.join(" - ");
  });
}

function renderGrades(m: Methodology): string[] {
  const scale = m.grade_scale ?? [];
  if (scale.length === 0) return [];
  return [
    "Grade scale (composite score 0-100):",
    ...scale.map((g) => `${g.grade} - ${g.min_score}+ - ${g.description}`),
  ];
}

export async function getMethodology(client: VerdictClient): Promise<ToolResult> {
  let m: Methodology;
  try {
    m = await client.getMethodology();
  } catch (err) {
    return errorResult(friendlyError(err));
  }

  const name = m.name ?? "Verdict DeFi Ratings Framework";
  const version = m.version ? ` v${m.version}` : "";
  const scope =
    m.total_questions != null
      ? ` - ${m.total_questions} questions across ${(m.entity_types ?? []).length} entity types`
      : "";

  const lines = [`${name}${version}${scope}`, ""];
  const types = renderEntityTypes(m);
  if (types.length) lines.push(...types, "");
  const grades = renderGrades(m);
  if (grades.length) lines.push(...grades, "");
  if (m.grade_rounding) lines.push(`Rounding: ${m.grade_rounding}`, "");

  // The payload carries its own attribution + canonical URL; use them when
  // present so the source line is whatever Verdict is currently publishing.
  const link = m.methodology_url;
  lines.push(
    m.attribution && link
      ? `${m.attribution} ${link}`
      : attribution(link),
  );

  return textResult(lines.join("\n").trimEnd());
}
