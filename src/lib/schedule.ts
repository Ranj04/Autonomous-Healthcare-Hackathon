import type { DischargeParse, MedSchedule, ScheduledMed } from "@/lib/types";

// Deterministic (no LLM): expand each medication's frequency_per_day into a
// simple daily schedule of time-of-day slots.

const PRESETS: Record<number, string[]> = {
  1: ["9:00 AM"],
  2: ["9:00 AM", "9:00 PM"],
  3: ["8:00 AM", "2:00 PM", "8:00 PM"],
  4: ["8:00 AM", "12:00 PM", "4:00 PM", "8:00 PM"],
};

// Evenly spread n doses across the 8am-10pm waking window as a fallback.
function evenlySpread(n: number): string[] {
  if (n <= 0) return [];
  const startHour = 8;
  const windowHours = 14;
  const step = windowHours / n;
  return Array.from({ length: n }, (_, i) => {
    const hour = Math.round(startHour + step * i);
    const h12 = ((hour + 11) % 12) + 1;
    const suffix = hour < 12 || hour === 24 ? "AM" : "PM";
    return `${h12}:00 ${suffix}`;
  });
}

function dailySlots(freq: number): string[] {
  return PRESETS[freq] ?? evenlySpread(freq);
}

export function buildSchedule(parse: DischargeParse): MedSchedule {
  const meds: ScheduledMed[] = parse.medications.map((m) => ({
    name: m.name,
    duration: m.duration,
    as_needed: /as needed/i.test(m.duration),
    times: dailySlots(m.frequency_per_day),
  }));
  return { meds };
}
