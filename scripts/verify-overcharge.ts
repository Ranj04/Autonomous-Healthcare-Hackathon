// Phase 3 verify gate: run the deterministic comparator against ground truth
// (using the known-correct line items, isolating Phase 3 from parsing) plus a
// synthetic duplicate-detection test.
// Usage: npx tsx scripts/verify-overcharge.ts

import { readFileSync } from "node:fs";
import { analyzeBill } from "../src/lib/overcharge";
import type { BillParse } from "../src/lib/types";

const truth = JSON.parse(readFileSync("data/ground-truth.json", "utf8"));

let allPass = true;
const ok = (cond: boolean) => {
  if (!cond) allPass = false;
  return cond ? "✓" : "✗ MISMATCH";
};

for (const key of ["bill1_er", "bill2_mri", "bill3_office"] as const) {
  const t = truth[key];
  const parse: BillParse = {
    service_date: t.service_date,
    line_items: t.line_items.map((li: { cpt: string; description: string; billed: number }) => ({
      cpt: li.cpt,
      description: li.description,
      billed: li.billed,
    })),
  };

  const a = analyzeBill(parse);
  const flags = a.lines.filter((l) => l.flagged).map((l) => l.cpt).sort();
  const expectedFlags = [...t.expected_flags].sort();

  const flagsMatch = flags.join(",") === expectedFlags.join(",");
  const billedMatch = a.total_billed === t.expected_total_billed;
  const overchargeMatch = a.total_overcharge === t.expected_overcharge_vs_high;

  if (!(flagsMatch && billedMatch && overchargeMatch)) allPass = false;

  console.log(`\n${flagsMatch && billedMatch && overchargeMatch ? "✅" : "❌"} ${key}`);
  console.log(`   flags:          ${flags.join("/")}  ${ok(flagsMatch)}`);
  console.log(`   expected flags: ${expectedFlags.join("/")}`);
  console.log(`   total_billed:   ${a.total_billed} vs ${t.expected_total_billed}  ${ok(billedMatch)}`);
  console.log(`   overcharge:     ${a.total_overcharge} vs ${t.expected_overcharge_vs_high}  ${ok(overchargeMatch)}`);
}

// Synthetic duplicate-detection test: same CPT twice on the same service date.
console.log("\n— synthetic duplicate test —");
const dupParse: BillParse = {
  service_date: "2026-06-10",
  line_items: [
    { cpt: "99213", description: "Office visit", billed: 150 },
    { cpt: "36415", description: "Blood draw", billed: 15 },
    { cpt: "99213", description: "Office visit", billed: 150 }, // duplicate
  ],
};
const dup = analyzeBill(dupParse);
const dupFlagged = dup.lines.filter((l) => l.duplicate).map((l) => l.cpt);
const dupCorrect =
  dupFlagged.length === 2 &&
  dupFlagged.every((c) => c === "99213") &&
  dup.lines.find((l) => l.cpt === "36415")!.duplicate === false;
if (!dupCorrect) allPass = false;
console.log(`   99213 x2 flagged duplicate, 36415 not: ${ok(dupCorrect)}`);
console.log(`   duplicate-flagged CPTs: ${dupFlagged.join(", ")}`);

console.log(`\n${allPass ? "✅ PHASE 3 COMPARATOR CORRECT" : "❌ COMPARATOR FAILED"}`);
process.exit(allPass ? 0 : 1);
