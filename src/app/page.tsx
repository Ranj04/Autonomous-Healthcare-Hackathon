"use client";

import { useState } from "react";
import {
  DOC_TYPES,
  type BillAnalysis,
  type BillParse,
  type DischargeParse,
  type DocType,
  type MedSchedule,
} from "@/lib/types";
import VoicePanel, {
  type AppealState,
  type SummaryState,
} from "@/components/VoicePanel";
import TextPanel from "@/components/TextPanel";

type Mode = "talk" | "type";

type Meta = { received: string; bytes: number };
type BillResult = Meta & {
  docType: "bill";
  parsed: BillParse;
  analysis: BillAnalysis;
};
type DischargeResult = Meta & {
  docType: "discharge";
  parsed: DischargeParse;
  schedule: MedSchedule;
};
type UploadResult = BillResult | DischargeResult;

const money = (n: number) =>
  n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function Home() {
  const [docType, setDocType] = useState<DocType>("bill");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disputedIds, setDisputedIds] = useState<number[]>([]);
  const [appeal, setAppeal] = useState<AppealState | null>(null);
  const [summary, setSummary] = useState<SummaryState | null>(null);
  const [mode, setMode] = useState<Mode>("talk"); // default to voice (Talk)

  async function handleUpload() {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setDisputedIds([]);
    setAppeal(null);
    setSummary(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("docType", docType);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? `Server returned ${res.status}`);
      }
      if (docType === "bill" && !Array.isArray(data.parsed?.line_items)) {
        throw new Error("Server returned no bill line items");
      }
      if (docType === "discharge" && !Array.isArray(data.parsed?.medications)) {
        throw new Error("Server returned no discharge instructions");
      }
      setResult(data as UploadResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-xl">
        {/* Masthead */}
        <header className="rise" style={{ animationDelay: "0ms" }}>
          <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-accent">
            Case File — Patient Advocacy
          </p>
          <h1 className="mt-3 font-display text-6xl font-light leading-[0.95] tracking-tight text-ink">
            Paperwork
            <br />
            <span className="italic">Advocate</span>
          </h1>
          <p className="mt-5 max-w-md font-mono text-sm leading-relaxed text-ink-soft">
            File a medical document. We read it, audit every charge against fair
            prices, and let you argue your case out loud.
          </p>
        </header>

        {/* The intake form */}
        <div
          className="rise mt-10 border border-line bg-paper-raised p-7 shadow-[6px_6px_0_0_rgba(33,28,24,0.08)]"
          style={{ animationDelay: "120ms" }}
        >
          <div className="space-y-6">
            <div>
              <label className="block font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft">
                01 — Document type
              </label>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value as DocType)}
                className="mt-2 w-full border border-line bg-paper px-4 py-3 font-mono text-sm text-ink focus:border-accent focus:outline-none"
              >
                {DOC_TYPES.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft">
                02 — Evidence (image or PDF)
              </label>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="mt-2 w-full border border-line bg-paper px-4 py-2.5 font-mono text-sm text-ink-soft file:mr-4 file:border file:border-ink file:bg-ink file:px-3 file:py-1.5 file:font-mono file:text-xs file:uppercase file:tracking-wider file:text-paper hover:file:bg-accent hover:file:border-accent"
              />
            </div>

            <button
              onClick={handleUpload}
              disabled={!file || busy}
              className="group w-full bg-accent px-4 py-3.5 font-mono text-sm uppercase tracking-[0.2em] text-paper transition-all duration-200 hover:bg-accent-deep hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:bg-ink-soft disabled:opacity-50"
            >
              {busy ? "Reading the bill…" : "Open the file →"}
            </button>

            {error && (
              <p className="border-l-2 border-accent bg-paper px-4 py-3 font-mono text-sm text-accent-deep">
                {error}
              </p>
            )}
          </div>
        </div>

        {/* Overcharge audit (bill) */}
        {result?.docType === "bill" && (
          <div
            className="rise mt-6 border border-line bg-paper-raised p-6"
            style={{ animationDelay: "0ms" }}
          >
            <div className="flex items-baseline justify-between">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-seal">
                ✓ Bill read — {result.analysis.lines.length} line items
              </p>
              {result.parsed.service_date && (
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft">
                  {result.parsed.service_date}
                </p>
              )}
            </div>
            <p className="mt-1 font-mono text-[11px] text-ink-soft">
              {result.received}
            </p>

            {/* Overcharge tally */}
            <div className="mt-5 border border-accent/40 bg-accent/5 p-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent-deep">
                Estimated overcharge
              </p>
              <p className="mt-1 font-display text-4xl text-accent-deep">
                ${money(result.analysis.total_overcharge)}
              </p>
              <p className="mt-1 font-mono text-[11px] text-ink-soft">
                of ${money(result.analysis.total_billed)} billed
              </p>
            </div>

            <table className="mt-5 w-full font-mono text-sm">
              <thead>
                <tr className="border-b border-ink text-left text-[11px] uppercase tracking-[0.15em] text-ink-soft">
                  <th className="py-2 pr-3 font-medium">CPT</th>
                  <th className="py-2 pr-3 font-medium">Description</th>
                  <th className="py-2 px-3 text-right font-medium">Fair ≤</th>
                  <th className="py-2 pl-3 text-right font-medium">Billed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {result.analysis.lines.map((l) => (
                  <tr key={l.id} className={l.flagged ? "bg-accent/5" : ""}>
                    <td className="py-2.5 pr-3 align-top text-ink">{l.cpt}</td>
                    <td className="py-2.5 pr-3 align-top text-ink">
                      {l.description}
                      <span className="mt-1 flex flex-wrap gap-1">
                        {l.flagged && (
                          <span className="bg-accent px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-paper">
                            +${money(l.overcharge)} over
                          </span>
                        )}
                        {l.duplicate && (
                          <span className="bg-ink px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-paper">
                            Duplicate
                          </span>
                        )}
                        {disputedIds.includes(l.id) && (
                          <span className="border border-accent-deep px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-accent-deep">
                            Disputed
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right align-top tabular-nums text-ink-soft">
                      {l.fair_high === null ? "—" : `$${money(l.fair_high)}`}
                    </td>
                    <td
                      className={`py-2.5 pl-3 text-right align-top tabular-nums ${
                        l.flagged ? "font-semibold text-accent-deep" : "text-ink"
                      }`}
                    >
                      ${money(l.billed)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Discharge instructions */}
        {result?.docType === "discharge" && (
          <div className="rise mt-6 border border-line bg-paper-raised p-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-seal">
              ✓ Discharge read — {result.schedule.meds.length} medications
            </p>
            <p className="mt-1 font-mono text-[11px] text-ink-soft">
              {result.received}
            </p>

            <div className="mt-5 border border-line bg-paper p-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft">
                Diagnosis
              </p>
              <p className="mt-1 font-display text-2xl text-ink">
                {result.parsed.diagnosis}
              </p>
            </div>

            {/* Medication schedule */}
            <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft">
              Medication schedule
            </p>
            <table className="mt-2 w-full font-mono text-sm">
              <tbody className="divide-y divide-line">
                {result.schedule.meds.map((m, i) => (
                  <tr key={i}>
                    <td className="py-2.5 pr-3 align-top text-ink">{m.name}</td>
                    <td className="py-2.5 pl-3 text-right align-top text-ink-soft">
                      {m.as_needed
                        ? `As needed · up to ${m.times.length}×/day`
                        : m.times.join(" · ")}
                      <br />
                      <span className="text-[11px]">{m.duration}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Warning signs */}
            {result.parsed.warning_signs.length > 0 && (
              <div className="mt-5 border border-accent/40 bg-accent/5 p-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent-deep">
                  Seek care / call 911 if
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink">
                  {result.parsed.warning_signs.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Follow-ups + activity */}
            {result.parsed.follow_ups.length > 0 && (
              <DischargeList title="Follow-up" items={result.parsed.follow_ups} />
            )}
            {result.parsed.activity_restrictions.length > 0 && (
              <DischargeList
                title="Activity & home care"
                items={result.parsed.activity_restrictions}
              />
            )}
          </div>
        )}

        {/* Advocate — Talk (voice) or Type (text); both share session state */}
        {result && (
          <>
            <div className="rise mt-6 flex border border-line bg-paper-raised p-1">
              {(["talk", "type"] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex flex-1 items-center justify-center gap-2 px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.2em] transition-all ${
                    mode === m
                      ? "bg-ink text-paper"
                      : "text-ink-soft hover:text-ink"
                  }`}
                >
                  {m === "talk" ? (
                    <TalkIcon className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <TypeIcon className="h-3.5 w-3.5 shrink-0" />
                  )}
                  {m === "talk" ? "Talk" : "Type"}
                </button>
              ))}
            </div>

            {mode === "talk" ? (
              <VoicePanel
                docType={result.docType}
                parse={result.parsed}
                analysis={result.docType === "bill" ? result.analysis : undefined}
                schedule={
                  result.docType === "discharge" ? result.schedule : undefined
                }
                disputedIds={disputedIds}
                onMarkDisputed={(lineId) =>
                  setDisputedIds((prev) =>
                    prev.includes(lineId) ? prev : [...prev, lineId],
                  )
                }
                onAppeal={setAppeal}
                onSummary={setSummary}
              />
            ) : (
              <TextPanel
                docType={result.docType}
                parse={result.parsed}
                analysis={result.docType === "bill" ? result.analysis : undefined}
                schedule={
                  result.docType === "discharge" ? result.schedule : undefined
                }
                disputedIds={disputedIds}
                onMarkDisputed={(lineId) =>
                  setDisputedIds((prev) =>
                    prev.includes(lineId) ? prev : [...prev, lineId],
                  )
                }
                onAppeal={setAppeal}
                onSummary={setSummary}
              />
            )}
          </>
        )}

        {/* Appeal letter */}
        {appeal && (
          <div className="rise mt-6 border border-line bg-paper-raised p-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent-deep">
              Appeal letter
            </p>
            {appeal.status === "drafting" && (
              <p className="mt-3 font-mono text-sm text-ink-soft">Drafting…</p>
            )}
            {appeal.status === "error" && (
              <p className="mt-3 border-l-2 border-accent bg-paper px-3 py-2 font-mono text-sm text-accent-deep">
                {appeal.error}
              </p>
            )}
            {appeal.status === "ready" && (
              <>
                <pre className="mt-3 max-h-96 overflow-y-auto whitespace-pre-wrap border border-line bg-paper p-4 font-mono text-sm leading-relaxed text-ink">
                  {appeal.letter}
                </pre>
                <button
                  onClick={() => downloadPdf("appeal-letter.pdf", appeal.letter)}
                  className="mt-4 bg-ink px-4 py-2.5 font-mono text-xs uppercase tracking-[0.2em] text-paper transition-all hover:bg-accent"
                >
                  Download PDF ↓
                </button>
              </>
            )}
          </div>
        )}

        {/* Visit summary (discharge) */}
        {summary && (
          <div className="rise mt-6 border border-line bg-paper-raised p-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-seal">
              After-visit summary
            </p>
            {summary.status === "drafting" && (
              <p className="mt-3 font-mono text-sm text-ink-soft">Preparing…</p>
            )}
            {summary.status === "error" && (
              <p className="mt-3 border-l-2 border-accent bg-paper px-3 py-2 font-mono text-sm text-accent-deep">
                {summary.error}
              </p>
            )}
            {summary.status === "ready" && (
              <>
                <pre className="mt-3 max-h-96 overflow-y-auto whitespace-pre-wrap border border-line bg-paper p-4 font-mono text-sm leading-relaxed text-ink">
                  {summary.summary}
                </pre>
                <button
                  onClick={() =>
                    downloadPdf("after-visit-summary.pdf", summary.summary)
                  }
                  className="mt-4 bg-ink px-4 py-2.5 font-mono text-xs uppercase tracking-[0.2em] text-paper transition-all hover:bg-accent"
                >
                  Download PDF ↓
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function DischargeList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mt-5">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft">
        {title}
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}

// Monoline, square-cap icons matching VoicePanel's MicIcon aesthetic.
function TalkIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
      aria-hidden="true"
    >
      <rect x="5.5" y="2" width="5" height="8" rx="2.5" />
      <path d="M3 8a5 5 0 0 0 10 0" />
      <path d="M8 13v2" />
    </svg>
  );
}

function TypeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
      aria-hidden="true"
    >
      <rect x="1.5" y="4" width="13" height="8" rx="1" />
      <path d="M4 6.5h0M7 6.5h0M10 6.5h0M12 6.5h0M4 9h0" />
      <path d="M6 9.25h4" />
    </svg>
  );
}

async function downloadPdf(filename: string, text: string) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const margin = 56;
  const width = doc.internal.pageSize.getWidth() - margin * 2;
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFont("times", "normal");
  doc.setFontSize(11);
  const lines = doc.splitTextToSize(text, width);
  let y = margin;
  for (const line of lines) {
    if (y > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
    doc.text(line, margin, y);
    y += 16;
  }
  doc.save(filename);
}
