// Shared engine types. docType is threaded through parse -> process -> voice -> output.

export type DocType = "bill" | "discharge";

export const DOC_TYPES: { value: DocType; label: string }[] = [
  { value: "bill", label: "Medical bill" },
  { value: "discharge", label: "Discharge instructions" },
];

// ----- bill parsing (Phase 2) -----

export type BillLineItem = {
  description: string;
  cpt: string;
  billed: number;
};

export type BillParse = {
  patient_name?: string;
  service_date?: string;
  line_items: BillLineItem[];
};

// ----- deterministic overcharge analysis (Phase 3) -----

export type AnalyzedLine = {
  id: number;
  description: string;
  cpt: string;
  billed: number;
  fair_high: number | null; // null when the CPT has no benchmark
  flagged: boolean; // billed > fair_high
  duplicate: boolean; // same CPT repeated for the service date
  overcharge: number; // billed - fair_high when flagged, else 0
};

export type BillAnalysis = {
  lines: AnalyzedLine[];
  total_billed: number;
  total_overcharge: number;
};
