"use client";

import { useEffect, useRef, useState } from "react";
import type {
  BillAnalysis,
  BillParse,
  DischargeParse,
  DocType,
  MedSchedule,
} from "@/lib/types";
import { runDraftAppeal } from "@/lib/appeal-client";
import { runGenerateSummary } from "@/lib/summary-client";
import type { AppealState, SummaryState } from "@/components/VoicePanel";

type Turn = { role: "user" | "agent"; text: string };

// A Responses API function-call item, as returned in the `output` array.
type FunctionCall = {
  type: "function_call";
  call_id: string;
  name: string;
  arguments: string;
};

// Pull assistant-visible text out of the Responses `output` items.
function assistantText(output: unknown[]): string {
  const parts: string[] = [];
  for (const item of output as {
    type?: string;
    role?: string;
    content?: { type?: string; text?: string }[];
  }[]) {
    if (item.type === "message" && item.role === "assistant") {
      for (const c of item.content ?? []) {
        if (c.type === "output_text" && c.text) parts.push(c.text);
      }
    }
  }
  return parts.join("");
}

export default function TextPanel({
  docType,
  parse,
  analysis,
  disputedIds = [],
  onMarkDisputed,
  onAppeal,
  onSummary,
}: {
  docType: DocType;
  parse: BillParse | DischargeParse;
  analysis?: BillAnalysis;
  schedule?: MedSchedule;
  disputedIds?: number[];
  onMarkDisputed?: (lineId: number) => void;
  onAppeal?: (state: AppealState) => void;
  onSummary?: (state: SummaryState) => void;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The chat API is stateless; we keep the full conversation client-side as the
  // Responses `input` array and resend it every turn.
  const historyRef = useRef<unknown[]>([]);

  // Keep the latest disputed set (including lines marked in voice mode) so a
  // draft_appeal fired here always sends the current set. We also mutate this on
  // mark_disputed so an appeal requested later in the same turn sees it.
  const disputedIdsRef = useRef(disputedIds);
  useEffect(() => {
    disputedIdsRef.current = disputedIds;
  }, [disputedIds]);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [turns, busy]);

  const pushTurn = (turn: Turn) => setTurns((prev) => [...prev, turn]);

  // Same tool handlers the voice path uses, so a disputed line or a drafted
  // appeal surfaces in the UI identically regardless of modality.
  const runTool = (fc: FunctionCall): unknown => {
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(fc.arguments || "{}");
    } catch {}

    if (fc.name === "mark_disputed" && typeof args.line_id === "number") {
      onMarkDisputed?.(args.line_id);
      if (!disputedIdsRef.current.includes(args.line_id)) {
        disputedIdsRef.current = [...disputedIdsRef.current, args.line_id];
      }
      return { ok: true, line_id: args.line_id, status: "marked_disputed" };
    }
    if (fc.name === "draft_appeal" && analysis && onAppeal) {
      const bill = parse as BillParse;
      runDraftAppeal({
        analysis,
        service_date: bill.service_date,
        disputedIds: disputedIdsRef.current,
        patient_name: bill.patient_name,
        onAppeal,
      }); // async; the letter renders on screen when ready
      return {
        ok: true,
        status: "drafting",
        message:
          "The appeal letter is being prepared and will appear on the patient's screen.",
      };
    }
    if (fc.name === "generate_summary" && onSummary) {
      runGenerateSummary({ parse: parse as DischargeParse, onSummary }); // async
      return {
        ok: true,
        status: "drafting",
        message:
          "The medication schedule and questions are being prepared and will appear on the patient's screen.",
      };
    }
    return { ok: false, error: `tool ${fc.name} not available` };
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || busy) return;
    setDraft("");
    setError(null);
    pushTurn({ role: "user", text });
    historyRef.current.push({ role: "user", content: text });
    setBusy(true);

    try {
      // Run the tool loop: ask the model, execute any tool calls, feed the
      // results back, and repeat until it answers in plain text.
      for (let guard = 0; guard < 6; guard++) {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            docType,
            parse,
            analysis,
            input: historyRef.current,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "chat turn failed");

        const output = (data.output ?? []) as unknown[];
        historyRef.current.push(...output); // keep the turn verbatim for context

        const replyText = (data.output_text as string) || assistantText(output);
        if (replyText) pushTurn({ role: "agent", text: replyText });

        const calls = output.filter(
          (o): o is FunctionCall =>
            (o as { type?: string }).type === "function_call",
        );
        if (calls.length === 0) break;

        for (const fc of calls) {
          const out = runTool(fc);
          historyRef.current.push({
            type: "function_call_output",
            call_id: fc.call_id,
            output: JSON.stringify(out),
          });
        }
        // loop again so the model can speak after the tool results
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "chat turn failed");
    } finally {
      setBusy(false);
    }
  };

  const disputedSet = new Set(disputedIds);

  return (
    <div className="rise mt-6 border border-line bg-paper-raised p-6">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft">
          Type to your advocate
        </p>
        {busy && (
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
            ● thinking
          </span>
        )}
      </div>

      {/* Message thread */}
      <div ref={scrollRef} className="mt-4 max-h-72 space-y-3 overflow-y-auto">
        {turns.length === 0 ? (
          <p className="font-mono text-xs leading-relaxed text-ink-soft">
            {docType === "bill"
              ? "Ask anything about your bill — e.g. “Why is the CT scan so expensive?” or “Walk me through my bill.”"
              : "Ask anything about your discharge instructions — e.g. “When do I take my antibiotic?” or “Make me a schedule and questions for my doctor.”"}
          </p>
        ) : (
          turns.map((turn, i) => (
            <div key={i}>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
                {turn.role === "user" ? "You" : "Advocate"}
              </p>
              <p className="mt-0.5 text-sm leading-relaxed text-ink">{turn.text}</p>
            </div>
          ))
        )}
      </div>

      {/* Composer */}
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a message…"
          disabled={busy}
          className="min-w-0 flex-1 border border-line bg-paper px-4 py-3 font-mono text-sm text-ink placeholder:text-ink-soft focus:border-accent focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={busy || !draft.trim()}
          className="shrink-0 bg-ink px-5 py-3 font-mono text-sm uppercase tracking-[0.2em] text-paper transition-all hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          Send
        </button>
      </form>

      {error && (
        <p className="mt-3 border-l-2 border-accent bg-paper px-3 py-2 font-mono text-xs text-accent-deep">
          {error}
        </p>
      )}

      {/* Disputed lines — same shared state the voice panel shows (bill only) */}
      {analysis && disputedIds.length > 0 && (
        <div className="mt-5 border-t border-line pt-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent-deep">
            Marked as not recalled ({disputedIds.length})
          </p>
          <ul className="mt-2 space-y-1">
            {analysis.lines
              .filter((l) => disputedSet.has(l.id))
              .map((l) => (
                <li key={l.id} className="font-mono text-xs text-ink">
                  {l.cpt} — {l.description}
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}
