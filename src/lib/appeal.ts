import type { BillAnalysis } from "@/lib/types";
import { xaiChat } from "@/lib/xai";

// The figures come from the deterministic analysis, not the model. We hand the
// model exact numbers and ask only for professional prose around them.

const APPEAL_SYSTEM = `You are a patient's billing advocate drafting a formal medical-bill appeal letter.
Write a short, professional letter to the billing department. Rules:
- Use ONLY the dollar amounts, CPT codes, and descriptions provided. Never invent
  or alter a number, account detail, or fact.
- Use the patient_name provided for the salutation/signature. For other details
  you are not given (account number, date), use bracketed placeholders like
  [Account Number], [Date].
- Exactly two body sections with these headings:
  1. "Overcharges" — list each line on its own line as a dash bullet: name the CPT
     code and description, the amount billed, the fair-price reference, and request
     an adjustment down to the fair price. If a line is flagged as a duplicate,
     note it is billed more than once for the same date of service and request the
     duplicate be removed.
  2. "Charges Not Recalled" — list each line on its own line as a dash bullet:
     state the patient does not recall receiving this service and requests itemized
     verification and documentation. Frame as a request to verify, NOT an
     accusation of fraud.
- Format every dollar amount with a dollar sign and thousands separators (e.g. $2,800).
- Keep it concise and courteous. Plain text only, no markdown.
- If a section has no line items, omit that section entirely.`;

export async function draftAppealLetter(
  analysis: BillAnalysis,
  serviceDate: string | undefined,
  disputedIds: number[],
  patientName: string | undefined,
): Promise<string> {
  const overcharges = analysis.lines
    .filter((l) => l.flagged || l.duplicate)
    .map((l) => ({
      cpt: l.cpt,
      description: l.description,
      billed: l.billed,
      fair_price_reference: l.fair_high,
      requested_adjustment_to: l.fair_high,
      duplicate: l.duplicate,
    }));

  const notRecalled = analysis.lines
    .filter((l) => disputedIds.includes(l.id))
    .map((l) => ({ cpt: l.cpt, description: l.description, billed: l.billed }));

  const payload = {
    patient_name: patientName ?? "[Patient Name]",
    service_date: serviceDate ?? "[Date of Service]",
    total_billed: analysis.total_billed,
    total_overcharge: analysis.total_overcharge,
    overcharges,
    charges_not_recalled: notRecalled,
  };

  const user = `Draft the appeal letter from this data (JSON):\n${JSON.stringify(payload, null, 2)}`;
  return xaiChat(APPEAL_SYSTEM, user);
}
