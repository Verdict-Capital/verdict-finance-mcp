import { z } from "zod";
import type { EntityType } from "../entities.js";
import { VerdictError, type ContactReceipt, type VerdictClient } from "../client.js";
import { errorResult, friendlyError, textResult, type ToolResult } from "../respond.js";
import { entityTypeSchema } from "../schema.js";
import { SITE_URL } from "../identity.js";

const CONTACT_URL = `${SITE_URL}/contact`;

// The public contacts endpoint keys the "Get rated" flow on this request_type,
// so a rating request from an agent lands in the same queue as one from the
// website form rather than in the generic support pile.
const REQUEST_TYPE = "rating-request";

export const requestNewRatingInput = {
  entity_name: z
    .string()
    .min(1)
    .max(200)
    .describe("The entity to rate, as it is publicly known, e.g. 'Morpho Blue'."),
  entity_type: entityTypeSchema.describe(
    "What kind of entity it is: protocol, chain, token, oracle, vault, organisation, or bridge.",
  ),
  contact_email: z
    .string()
    .email()
    .describe("Email the Verdict team replies to. Ask the user for it; never invent one."),
  note: z
    .string()
    .max(4000)
    .optional()
    .describe("Optional context: links, chains it is live on, why it matters, any deadline."),
} as const;

export const requestNewRatingMeta = {
  name: "request_new_rating",
  title: "Request a new Verdict rating",
  description:
    "Ask Verdict to rate an entity it does not rate yet, and get a reference id back. Requesting a rating never buys a grade or moves one: ratings stay independent, and the resulting rating is public either way, readable by anyone through these tools. The team replies to the email address you pass, so ask the user for a real one first. Example: request_new_rating({ entity_name: 'Morpho Blue', entity_type: 'protocol', contact_email: 'team@example.com' }).",
};

function buildMessage(args: {
  entity_type: EntityType;
  entity_name: string;
  note?: string;
}): string {
  const lines = [
    "Rating request submitted through the Verdict MCP server.",
    `Entity: ${args.entity_name}`,
    `Entity type: ${args.entity_type}`,
  ];
  if (args.note) lines.push("", args.note);
  return lines.join("\n");
}

export async function requestNewRating(
  client: VerdictClient,
  args: {
    entity_name: string;
    entity_type: EntityType;
    contact_email: string;
    note?: string;
  },
): Promise<ToolResult> {
  let receipt: ContactReceipt;
  try {
    receipt = await client.submitContactRequest({
      protocol_name: args.entity_name,
      contact_email: args.contact_email,
      request_type: REQUEST_TYPE,
      message: buildMessage(args),
    });
  } catch (err) {
    if (err instanceof VerdictError && err.kind === "rate_limit") {
      // The submit route has its own, much smaller per-IP allowance than the
      // read API, so the generic read-limit copy would misdescribe this.
      return textResult(
        `Verdict is rate limiting rating requests from this IP right now. Wait and try again, or submit the request directly at ${CONTACT_URL}.`,
      );
    }
    return errorResult(friendlyError(err));
  }

  const ref = receipt.id ? ` Reference: ${receipt.id}.` : "";
  return textResult(
    [
      `Rating request submitted for ${args.entity_name} (${args.entity_type}).${ref} The Verdict team replies to ${args.contact_email}.`,
      "Requesting a rating does not buy a grade or move one: the resulting rating is public either way, and readable by anyone through these tools.",
    ].join("\n"),
  );
}
