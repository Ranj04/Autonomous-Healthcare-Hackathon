import type { BillParse, DocType } from "@/lib/types";
import { parseJsonFromModel, xaiVision } from "@/lib/xai";

// docType-keyed dispatch. Only "bill" is implemented now; "discharge" lands in Phase 7.
export async function parseDocument(
  docType: DocType,
  imageDataUrls: string[],
): Promise<BillParse> {
  if (docType === "bill") return parseBill(imageDataUrls);
  throw new Error(`Parser for docType "${docType}" not implemented yet`);
}

const BILL_SYSTEM = `You read medical bills and extract their line items as structured data.
Return ONLY valid JSON, no prose, no markdown fences.`;

const BILL_PROMPT = `Extract the billed line items from this medical bill image.

Return JSON of exactly this shape:
{
  "patient_name": string | null,
  "service_date": "YYYY-MM-DD" | null,
  "line_items": [
    { "description": string, "cpt": string, "billed": number }
  ]
}

Rules:
- "patient_name" is the patient's name as printed on the bill, or null if absent.
- "cpt" is the CPT/HCPCS code shown for the line (a 5-character code). Copy it exactly.
- "billed" is the charge amount as a plain number (no "$", no commas).
- "description" is the service description text for that line.
- Include only billed service line items. Do NOT include totals, subtotals,
  "total charges", or "patient responsibility" rows.
- If no service date is present, use null.`;

async function parseBill(imageDataUrls: string[]): Promise<BillParse> {
  const text = await xaiVision(BILL_SYSTEM, BILL_PROMPT, imageDataUrls);
  const parsed = parseJsonFromModel<Partial<BillParse>>(text);
  if (!Array.isArray(parsed.line_items)) {
    throw new Error("Model response missing line_items array");
  }
  return {
    patient_name: parsed.patient_name ?? undefined,
    service_date: parsed.service_date ?? undefined,
    line_items: parsed.line_items.map((li) => ({
      description: String(li.description ?? ""),
      cpt: String(li.cpt ?? "").trim(),
      billed: Number(li.billed),
    })),
  };
}
