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

// ----- discharge parsing + schedule (Phase 7) -----

export type DischargeMedication = {
  name: string;
  frequency_per_day: number;
  duration: string;
};

export type DischargeParse = {
  diagnosis: string;
  medications: DischargeMedication[];
  follow_ups: string[];
  warning_signs: string[];
  activity_restrictions: string[];
};

export type ScheduledMed = {
  name: string;
  duration: string;
  as_needed: boolean;
  times: string[]; // time-of-day slots, e.g. ["8:00 AM", "8:00 PM"]
};

export type MedSchedule = {
  meds: ScheduledMed[];
};
