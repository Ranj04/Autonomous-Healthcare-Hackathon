import type { DischargeParse } from "@/lib/types";
import { buildSchedule } from "@/lib/schedule";
import { xaiChat } from "@/lib/xai";

// The medication schedule is built deterministically (no LLM). Only the short
// list of follow-up questions is generated, grounded on the provided document.

const QUESTIONS_SYSTEM = `You help a patient prepare for a follow-up visit. Given their discharge
information, write 3 to 5 short, specific questions they should ask their care
provider at the next appointment. Base the questions ONLY on the provided
diagnosis, follow-ups, and warning signs — do not invent clinical details or
give medical advice. Return a plain numbered list, one question per line, no
preamble or closing.`;

export async function draftVisitSummary(parse: DischargeParse): Promise<string> {
  const schedule = buildSchedule(parse);

  const scheduleLines = schedule.meds.map((m) => {
    const when = m.as_needed
      ? `As needed — up to ${m.times.length} time(s) per day`
      : `Take at ${m.times.join(", ")}`;
    return `- ${m.name}: ${when} (${m.duration})`;
  });

  const questions = await xaiChat(
    QUESTIONS_SYSTEM,
    JSON.stringify(
      {
        diagnosis: parse.diagnosis,
        follow_ups: parse.follow_ups,
        warning_signs: parse.warning_signs,
      },
      null,
      2,
    ),
  );

  return [
    "AFTER-VISIT SUMMARY",
    "",
    `Diagnosis: ${parse.diagnosis}`,
    "",
    "Your medication schedule:",
    ...scheduleLines,
    "",
    "Questions for your next appointment:",
    questions.trim(),
  ].join("\n");
}
