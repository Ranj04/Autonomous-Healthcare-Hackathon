// Phase 7 (deterministic): run the schedule processor on the ground-truth
// medications and check it expands frequency_per_day into the right slots and
// flags as-needed meds. No LLM.
// Usage: npx tsx scripts/verify-schedule.ts

import { readFileSync } from "node:fs";
import { buildSchedule } from "../src/lib/schedule";
import type { DischargeParse } from "../src/lib/types";

const truth = JSON.parse(readFileSync("data/discharge-ground-truth.json", "utf8"))
  .discharge1;

const parse: DischargeParse = {
  diagnosis: truth.diagnosis,
  medications: truth.medications,
  follow_ups: truth.follow_ups,
  warning_signs: truth.warning_signs,
  activity_restrictions: truth.activity_restrictions,
};

const { meds } = buildSchedule(parse);
let pass = true;
const check = (label: string, cond: boolean) => {
  console.log(`${cond ? "✅" : "❌"} ${label}`);
  if (!cond) pass = false;
};

check(`3 medications scheduled`, meds.length === 3);

for (const m of parse.medications) {
  const s = meds.find((x) => x.name === m.name)!;
  check(
    `${m.name}: ${s.times.length} slots == frequency ${m.frequency_per_day}`,
    s.times.length === m.frequency_per_day,
  );
}

const amox = meds.find((m) => m.name.includes("Amoxicillin"))!;
const acet = meds.find((m) => m.name.includes("Acetaminophen"))!;
check("Amoxicillin (7 days) NOT as-needed", amox.as_needed === false);
check("Acetaminophen (as needed) flagged as-needed", acet.as_needed === true);
check("Amoxicillin twice-daily slots", JSON.stringify(amox.times) === JSON.stringify(["9:00 AM", "9:00 PM"]));

console.log("\nschedule:");
for (const m of meds) console.log(`  ${m.name} -> [${m.times.join(", ")}] as_needed=${m.as_needed}`);

console.log(`\n${pass ? "✅ SCHEDULE PROCESSOR CORRECT" : "❌ SCHEDULE FAILED"}`);
process.exit(pass ? 0 : 1);
