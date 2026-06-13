// Phase 2 verify gate: parse each bill PDF through the running dev server
// and compare CPT codes + billed amounts to data/ground-truth.json.
// Usage: node scripts/verify-parse.mjs   (dev server must be running on :3000)

import { readFileSync } from "node:fs";

const truth = JSON.parse(readFileSync("data/ground-truth.json", "utf8"));
const BILLS = {
  bill1_er: "public/test-bills/bill1_er.pdf",
  bill2_mri: "public/test-bills/bill2_mri.pdf",
  bill3_office: "public/test-bills/bill3_office.pdf",
};

let allPass = true;

for (const [key, path] of Object.entries(BILLS)) {
  const buf = readFileSync(path);
  const form = new FormData();
  form.append("file", new Blob([buf], { type: "application/pdf" }), `${key}.pdf`);
  form.append("docType", "bill");

  const res = await fetch("http://localhost:3000/api/upload", {
    method: "POST",
    body: form,
  });
  const data = await res.json();
  if (!res.ok) {
    console.log(`\n❌ ${key}: server error → ${data.error}`);
    allPass = false;
    continue;
  }

  const got = data.parsed.line_items;
  const want = truth[key].line_items;

  // Compare as CPT -> billed maps (order-independent).
  const gotMap = Object.fromEntries(got.map((li) => [li.cpt, li.billed]));
  const wantMap = Object.fromEntries(want.map((li) => [li.cpt, li.billed]));

  const cptsMatch =
    Object.keys(gotMap).sort().join(",") ===
    Object.keys(wantMap).sort().join(",");
  const amountsMatch = Object.entries(wantMap).every(
    ([cpt, amt]) => gotMap[cpt] === amt,
  );
  const dateMatch = data.parsed.service_date === truth[key].service_date;

  const pass = cptsMatch && amountsMatch && dateMatch;
  allPass = allPass && pass;

  console.log(`\n${pass ? "✅" : "❌"} ${key}`);
  console.log(`   service_date: got ${data.parsed.service_date} | want ${truth[key].service_date} ${dateMatch ? "✓" : "✗"}`);
  console.log(`   CPT set: ${cptsMatch ? "✓ match" : "✗ MISMATCH"}`);
  console.log(`   amounts: ${amountsMatch ? "✓ match" : "✗ MISMATCH"}`);
  if (!pass) {
    console.log("   got: ", JSON.stringify(gotMap));
    console.log("   want:", JSON.stringify(wantMap));
  }
}

console.log(`\n${allPass ? "✅ ALL THREE BILLS PARSE CORRECTLY" : "❌ SOME BILLS FAILED"}`);
process.exit(allPass ? 0 : 1);
