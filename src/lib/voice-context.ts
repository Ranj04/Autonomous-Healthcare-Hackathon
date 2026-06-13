import type { BillAnalysis, BillParse, DocType } from "@/lib/types";

export const VOICE_MODEL = "grok-voice-think-fast-1.0";
export const VOICE_NAME = "ara"; // warm female — calm patient advocate

// Verbatim bill advocate system prompt (from the brief).
const BILL_SYSTEM_PROMPT = `You are a calm, plain-spoken patient billing advocate. You help people
understand and contest their medical bills.

You are given the patient's parsed bill line items and an overcharge
analysis (including any duplicate-charge flags). Rules:
- Only state prices that appear in the provided analysis. If a code has
  no benchmark, say you don't have a fair-price reference for it. NEVER
  guess or estimate a price.
- Explain in everyday language. No jargon without a plain definition.
- Respond in the language the user speaks to you in; switch if they switch.
- Be concrete: name the line, the billed amount, and the fair range.

Did-you-receive-it walkthrough:
- You can offer to walk the patient through the line items and ask, for
  each, whether they remember receiving it. Lead with the lines most worth
  checking: overcharge-flagged lines, duplicate-flagged lines, and lines
  that fall into categories billing advocates commonly say are worth
  double-checking — supplies/kits/incidentals, time-based charges (e.g.
  operating-room or anesthesia time), and items that look separately billed
  when they're usually routine add-ons.
- Frame these honestly as worth verifying, NOT as proven errors. Say
  something like "this is a kind of charge that's worth double-checking —
  do you remember receiving it?" You do NOT know what happened in the room;
  only the patient does. Never assert on your own that a service wasn't
  provided, and never cite a statistic or percentage about phantom charges.
- If the patient says they don't recall a line, call mark_disputed for that
  line so it can be added to the appeal. Don't pressure them; if they're
  unsure, leave it off.
- When the user asks to contest or appeal, call the draft_appeal tool.
- Be warm but brief.`;

// Build the analysis as a compact, model-readable context block.
function billContext(parse: BillParse, analysis: BillAnalysis): string {
  const lines = analysis.lines.map((l) => ({
    line_id: l.id,
    cpt: l.cpt,
    description: l.description,
    billed: l.billed,
    fair_price_high: l.fair_high,
    overcharge_flagged: l.flagged,
    overcharge_amount: l.overcharge,
    duplicate_flagged: l.duplicate,
  }));
  return [
    `Service date: ${parse.service_date ?? "unknown"}`,
    `Total billed: $${analysis.total_billed}`,
    `Total overcharge vs fair price: $${analysis.total_overcharge}`,
    `Line items and overcharge analysis (JSON):`,
    JSON.stringify(lines, null, 2),
  ].join("\n");
}

export type RealtimeTool = {
  type: "function";
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

const MARK_DISPUTED_TOOL: RealtimeTool = {
  type: "function",
  name: "mark_disputed",
  description:
    "Record that the patient does not recall receiving a specific bill line, so it can be added to the appeal as a request to verify. Call this only when the patient says they don't remember receiving that line.",
  parameters: {
    type: "object",
    properties: {
      line_id: {
        type: "integer",
        description: "The line_id of the bill line the patient does not recall.",
      },
    },
    required: ["line_id"],
  },
};

const DRAFT_APPEAL_TOOL: RealtimeTool = {
  type: "function",
  name: "draft_appeal",
  description:
    "Generate a formal appeal letter covering the overcharged/duplicate lines and any lines the patient marked as not recalled. Call this when the patient asks to contest, appeal, or write a letter. Takes no arguments.",
  parameters: { type: "object", properties: {} },
};

// docType-keyed. Only "bill" is wired now; "discharge" lands in Phase 7.
export function buildVoiceSession(
  docType: DocType,
  parse: BillParse,
  analysis: BillAnalysis,
): { instructions: string; tools: RealtimeTool[] } {
  if (docType === "bill") {
    return {
      instructions: `${BILL_SYSTEM_PROMPT}\n\n=== PATIENT'S BILL ===\n${billContext(parse, analysis)}`,
      tools: [MARK_DISPUTED_TOOL, DRAFT_APPEAL_TOOL],
    };
  }
  throw new Error(`Voice session for docType "${docType}" not implemented yet`);
}
