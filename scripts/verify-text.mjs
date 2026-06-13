// Text-chat smoke test: drives the real /api/chat route (which reuses
// buildVoiceSession's prompt + tools) with a synthetic bill, exercising the
// same tool loop the TextPanel runs. Validates grounding, the no-benchmark
// refusal, and that draft_appeal fires — the automatable part of the gate.
// Usage: node scripts/verify-text.mjs   (dev server must be running on :3000)

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

// Mirror TextPanel.assistantText: pull text out of assistant message items.
function assistantText(output) {
  const parts = [];
  for (const item of output) {
    if (item.type === "message" && item.role === "assistant") {
      for (const c of item.content ?? []) {
        if (c.type === "output_text" && c.text) parts.push(c.text);
      }
    }
  }
  return parts.join("");
}

const parse = {
  service_date: "2026-01-15",
  patient_name: "Jane Doe",
  line_items: [],
};

const analysis = {
  lines: [
    {
      id: 0,
      cpt: "70450",
      description: "CT scan, head/brain, without contrast",
      billed: 5200,
      fair_high: 1200,
      flagged: true,
      duplicate: false,
      overcharge: 4000,
    },
    {
      id: 1,
      cpt: "99284",
      description: "Emergency department visit, level 4",
      billed: 3000,
      fair_high: null, // no benchmark — advocate must decline to invent a price
      flagged: false,
      duplicate: false,
      overcharge: 0,
    },
  ],
  total_billed: 8200,
  total_overcharge: 4000,
};

// Run one user message through the route's tool loop; return {text, tools[]}.
async function ask(history, message) {
  history.push({ role: "user", content: message });
  let text = "";
  const tools = [];
  for (let guard = 0; guard < 6; guard++) {
    const res = await fetch(`${BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ docType: "bill", parse, analysis, input: history }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error("chat route failed: " + JSON.stringify(data));
    const output = data.output ?? [];
    history.push(...output);
    text += data.output_text || assistantText(output);
    const calls = output.filter((o) => o.type === "function_call");
    if (calls.length === 0) break;
    for (const fc of calls) {
      tools.push(fc.name);
      // echo a benign tool result so the model can continue
      history.push({
        type: "function_call_output",
        call_id: fc.call_id,
        output: JSON.stringify({ ok: true, status: "done" }),
      });
    }
  }
  return { text, tools };
}

let failures = 0;
const check = (name, cond, detail) => {
  console.log(`${cond ? "✓" : "❌"} ${name}`);
  if (!cond) {
    console.log("   ", detail);
    failures++;
  }
};

const history = [];

// 1) Grounded answer naming the billed amount.
const a = await ask(history, "Why is the CT scan so expensive?");
console.log("\n[CT scan] →", a.text.replace(/\s+/g, " ").slice(0, 280), "\n");
check(
  "Grounded: names billed $5,200 and fair ~$1,200",
  /5,?200/.test(a.text) && /1,?200/.test(a.text),
  a.text,
);

// 2) No benchmark → declines to invent a price.
const b = await ask(history, "What is the fair price for the level 4 ER visit, code 99284?");
console.log("[ER visit] →", b.text.replace(/\s+/g, " ").slice(0, 280), "\n");
check(
  "Declines to invent a price for the no-benchmark line",
  /(don'?t|do not|no)\b.*(fair|benchmark|reference|price)|no fair[- ]price reference|can'?t (give|provide|estimate)/i.test(
    b.text,
  ),
  b.text,
);

// 3) "Write my appeal" → draft_appeal tool fires.
const c = await ask(history, "Okay, write my appeal letter.");
console.log("[appeal] tools fired →", c.tools.join(", ") || "(none)", "\n");
check("draft_appeal tool fires on appeal request", c.tools.includes("draft_appeal"), c.tools);

console.log(failures === 0 ? "\n✅ TEXT CHAT SMOKE OK" : `\n❌ ${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
