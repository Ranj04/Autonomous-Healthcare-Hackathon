import type { AnalyzedLine, BillAnalysis, BillParse } from "@/lib/types";
import referenceData from "../../data/reference.json";

// The anti-hallucination guarantee: overcharge + duplicate detection is plain
// deterministic code joined to the fair-price table. The LLM never decides this.

type RefEntry = {
  cpt: string;
  description: string;
  fair_price_usd: { low: number; median: number; high: number };
};

const fairHighByCpt = new Map(
  (referenceData as RefEntry[]).map((r) => [r.cpt, r.fair_price_usd.high]),
);

const round2 = (n: number) => Math.round(n * 100) / 100;

export function analyzeBill(parse: BillParse): BillAnalysis {
  // Duplicate = same CPT appearing more than once. All line items on a bill
  // share its single service_date, so a repeated CPT is a same-date duplicate.
  const cptCounts = new Map<string, number>();
  for (const li of parse.line_items) {
    cptCounts.set(li.cpt, (cptCounts.get(li.cpt) ?? 0) + 1);
  }

  const lines: AnalyzedLine[] = parse.line_items.map((li, id) => {
    const fair_high = fairHighByCpt.get(li.cpt) ?? null;
    const flagged = fair_high !== null && li.billed > fair_high;
    return {
      id,
      description: li.description,
      cpt: li.cpt,
      billed: li.billed,
      fair_high,
      flagged,
      duplicate: (cptCounts.get(li.cpt) ?? 0) > 1,
      overcharge: flagged ? round2(li.billed - (fair_high as number)) : 0,
    };
  });

  return {
    lines,
    total_billed: round2(lines.reduce((s, l) => s + l.billed, 0)),
    total_overcharge: round2(lines.reduce((s, l) => s + l.overcharge, 0)),
  };
}
