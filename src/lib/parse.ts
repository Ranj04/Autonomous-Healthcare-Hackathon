import type { BillParse, DischargeParse, DocType } from "@/lib/types";
import { parseJsonFromModel, xaiVision } from "@/lib/xai";

// docType-keyed dispatch. Each branch returns the parse shape for its docType.
export async function parseDocument(
  docType: "bill",
  imageDataUrls: string[],
): Promise<BillParse>;
export async function parseDocument(
  docType: "discharge",
  imageDataUrls: string[],
): Promise<DischargeParse>;
export async function parseDocument(
  docType: DocType,
  imageDataUrls: string[],
): Promise<BillParse | DischargeParse> {
  if (docType === "bill") return parseBill(imageDataUrls);
  return parseDischarge(imageDataUrls);
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

const DISCHARGE_SYSTEM = `You read hospital discharge / after-visit instructions and extract them as
structured data. Return ONLY valid JSON, no prose, no markdown fences.`;

const DISCHARGE_PROMPT = `Extract the discharge instructions from this document image.

Return JSON of exactly this shape:
{
  "diagnosis": string,
  "medications": [
    { "name": string, "frequency_per_day": number, "duration": string }
  ],
  "follow_ups": [string],
  "warning_signs": [string],
  "activity_restrictions": [string]
}

Rules:
- "diagnosis" is the primary diagnosis stated on the document.
- For each medication: "name" includes the drug and strength as printed;
  "frequency_per_day" is how many times per day it is taken, as a number
  ("twice daily" -> 2, "every 6 hours" -> 4). For an hourly range like
  "every 4-6 hours", use the LONGER interval (the larger hour value) to compute
  it: every 4-6 hours -> every 6 hours -> 24/6 = 4. "duration" is the course
  length text (e.g. "7 days", "as needed").
- "follow_ups", "warning_signs", "activity_restrictions" are arrays of the exact
  instruction lines as printed. Copy each as a separate string.
- Do not invent or add advice not present in the document.`;

async function parseDischarge(imageDataUrls: string[]): Promise<DischargeParse> {
  const text = await xaiVision(DISCHARGE_SYSTEM, DISCHARGE_PROMPT, imageDataUrls);
  const parsed = parseJsonFromModel<Partial<DischargeParse>>(text);
  if (!Array.isArray(parsed.medications)) {
    throw new Error("Model response missing medications array");
  }
  const arr = (v: unknown): string[] =>
    Array.isArray(v) ? v.map((s) => String(s)) : [];
  return {
    diagnosis: String(parsed.diagnosis ?? ""),
    medications: parsed.medications.map((m) => ({
      name: String(m.name ?? ""),
      frequency_per_day: Number(m.frequency_per_day),
      duration: String(m.duration ?? ""),
    })),
    follow_ups: arr(parsed.follow_ups),
    warning_signs: arr(parsed.warning_signs),
    activity_restrictions: arr(parsed.activity_restrictions),
  };
}
