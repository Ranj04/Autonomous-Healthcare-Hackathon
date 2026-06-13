import type { SummaryState } from "@/components/VoicePanel";
import type { DischargeParse } from "@/lib/types";

// Shared generate_summary handler for the voice and text paths. Posts to
// /api/summary and threads the result through onSummary, mirroring runDraftAppeal.
export async function runGenerateSummary(args: {
  parse: DischargeParse;
  onSummary: (state: SummaryState) => void;
}): Promise<void> {
  const { parse, onSummary } = args;
  onSummary({ status: "drafting" });
  try {
    const res = await fetch("/api/summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parse }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "summary generation failed");
    onSummary({ status: "ready", summary: data.summary });
  } catch (e) {
    onSummary({
      status: "error",
      error: e instanceof Error ? e.message : "summary generation failed",
    });
  }
}
