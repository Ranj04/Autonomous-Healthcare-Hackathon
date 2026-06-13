import type { AppealState } from "@/components/VoicePanel";
import type { BillAnalysis } from "@/lib/types";

// Single appeal-draft handler shared by the voice and text paths. Posting to
// /api/appeal and threading the result through onAppeal is identical in both
// modes, so the disputed line shows up the same way regardless of modality.
export async function runDraftAppeal(args: {
  analysis: BillAnalysis;
  service_date?: string;
  disputedIds: number[];
  patient_name?: string;
  onAppeal: (state: AppealState) => void;
}): Promise<void> {
  const { analysis, service_date, disputedIds, patient_name, onAppeal } = args;
  onAppeal({ status: "drafting" });
  try {
    const res = await fetch("/api/appeal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ analysis, service_date, disputedIds, patient_name }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "appeal draft failed");
    onAppeal({ status: "ready", letter: data.letter });
  } catch (e) {
    onAppeal({
      status: "error",
      error: e instanceof Error ? e.message : "appeal draft failed",
    });
  }
}
