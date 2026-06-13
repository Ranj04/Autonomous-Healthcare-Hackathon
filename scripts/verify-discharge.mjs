// Phase 7 verify gate: parse discharge1.pdf and compare to ground truth —
// 3 medications with correct frequencies, diagnosis, and the right counts /
// key content for follow-ups and warning signs. Also exercises /api/summary.
// Usage: node scripts/verify-discharge.mjs   (dev server running on :3000)

import { readFileSync } from "node:fs";

const truth = JSON.parse(readFileSync("data/discharge-ground-truth.json", "utf8"))
  .discharge1;

const buf = readFileSync("public/test-bills/discharge1.pdf");
const form = new FormData();
form.append("file", new Blob([buf], { type: "application/pdf" }), "discharge1.pdf");
form.append("docType", "discharge");

const res = await fetch("http://localhost:3000/api/upload", { method: "POST", body: form });
const data = await res.json();
if (!res.ok) {
  console.log("❌ upload error:", data.error);
  process.exit(1);
}
const p = data.parsed;
console.log("parsed:", JSON.stringify(p, null, 2), "\n");

let pass = true;
const check = (label, cond) => {
  console.log(`${cond ? "✅" : "❌"} ${label}`);
  if (!cond) pass = false;
};

// medications
check(`3 medications (expected ${truth.expected_med_count})`, p.medications.length === truth.expected_med_count);
const freqs = p.medications.map((m) => m.frequency_per_day).sort();
const wantFreqs = truth.medications.map((m) => m.frequency_per_day).sort();
check(`medication frequencies match [${wantFreqs}]`, JSON.stringify(freqs) === JSON.stringify(wantFreqs));
for (const name of ["Amoxicillin", "Acetaminophen", "Albuterol"]) {
  check(`includes ${name}`, p.medications.some((m) => m.name.includes(name)));
}

// diagnosis
check("diagnosis mentions pneumonia", /pneumonia/i.test(p.diagnosis));

// follow-ups and warning signs: counts + key content
check(`${truth.follow_ups.length} follow-ups`, p.follow_ups.length === truth.follow_ups.length);
check(`${truth.warning_signs.length} warning signs`, p.warning_signs.length === truth.warning_signs.length);
const warnText = p.warning_signs.join(" ").toLowerCase();
check("warning signs include breathing", warnText.includes("breath"));
check("warning signs include chest pain", warnText.includes("chest pain"));
check("warning signs include coughing up blood", warnText.includes("blood"));
check(`${truth.activity_restrictions.length} activity restrictions`, p.activity_restrictions.length === truth.activity_restrictions.length);

// generate_summary artifact (schedule + questions)
const sumRes = await fetch("http://localhost:3000/api/summary", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ parse: p }),
});
const sum = await sumRes.json();
if (!sumRes.ok) {
  check("summary generated", false);
} else {
  console.log("\n----- SUMMARY -----\n" + sum.summary + "\n-------------------");
  const s = sum.summary.toLowerCase();
  check("summary has medication schedule", s.includes("medication schedule"));
  check("summary lists the antibiotic", s.includes("amoxicillin"));
  check("summary has questions section", s.includes("questions for your next appointment"));
}

console.log(`\n${pass ? "✅ PHASE 7 DISCHARGE CORRECT" : "❌ PHASE 7 DISCHARGE FAILED"}`);
process.exit(pass ? 0 : 1);
