// Phase 5 verify gate: get bill1's real analysis, mark a line disputed, draft
// the appeal, and check the letter has the flagged figures (section 1) and the
// disputed line phrased as verify-not-accuse (section 2).
// Usage: node scripts/verify-appeal.mjs   (dev server running on :3000)

import { readFileSync } from "node:fs";

// 1) parse + analyze bill1 through the real pipeline
const buf = readFileSync("public/test-bills/bill1_er.pdf");
const form = new FormData();
form.append("file", new Blob([buf], { type: "application/pdf" }), "bill1_er.pdf");
form.append("docType", "bill");
const up = await (await fetch("http://localhost:3000/api/upload", { method: "POST", body: form })).json();
const analysis = up.analysis;
const serviceDate = up.parsed.service_date;

// CPT 36415 (blood draw) -> mark disputed
const disputedLine = analysis.lines.find((l) => l.cpt === "36415");
const disputedIds = [disputedLine.id];
console.log(`Marking line ${disputedLine.id} (${disputedLine.cpt} ${disputedLine.description}) as disputed`);

// 2) draft the appeal
const patientName = up.parsed.patient_name;
const res = await fetch("http://localhost:3000/api/appeal", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ analysis, service_date: serviceDate, disputedIds, patient_name: patientName }),
});
const data = await res.json();
if (!res.ok) {
  console.log("❌ appeal route error:", data.error);
  process.exit(1);
}
const letter = data.letter;
console.log("\n----- LETTER -----\n" + letter + "\n------------------\n");

const has = (s) => letter.includes(s);
let pass = true;
const check = (label, cond) => {
  console.log(`${cond ? "✅" : "❌"} ${label}`);
  if (!cond) pass = false;
};

// Section 1: flagged lines with correct figures
check("mentions 99285 (ER visit)", has("99285"));
check("mentions $2,800 billed for ER visit", has("2,800") || has("2800"));
check("mentions $2,200 fair price for ER visit", has("2,200") || has("2200"));
check("mentions 70450 (CT) and $1,400", has("70450") && (has("1,400") || has("1400")));
check("mentions 80053 and 85025 lab lines", has("80053") && has("85025"));

// Section 2: disputed line, verify-not-accuse
check("mentions disputed line 36415", has("36415"));
const lc = letter.toLowerCase();
check(
  "uses 'does not recall' / 'verify' wording (not an accusation)",
  (lc.includes("not recall") || lc.includes("does not remember")) &&
    (lc.includes("verif") || lc.includes("itemized")),
);
check("does NOT accuse of fraud", !lc.includes("fraud"));
check(`uses extracted patient name (${patientName})`, has(patientName));

console.log(`\n${pass ? "✅ PHASE 5 APPEAL LETTER CORRECT" : "❌ APPEAL LETTER FAILED"}`);
process.exit(pass ? 0 : 1);
