"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  BillAnalysis,
  BillParse,
  DischargeParse,
  DocType,
  MedSchedule,
} from "@/lib/types";
import {
  buildVoiceSession,
  VOICE_MODEL,
  VOICE_NAME,
} from "@/lib/voice-context";
import {
  floatToPcm16Base64,
  PcmPlayer,
  resampleTo24k,
  SAMPLE_RATE,
} from "@/lib/audio";
import { runDraftAppeal } from "@/lib/appeal-client";
import { runGenerateSummary } from "@/lib/summary-client";

type Status = "idle" | "connecting" | "connected" | "error";
type Turn = { role: "user" | "agent"; text: string };

function MicIcon({ className }: { className?: string }) {
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

// An ethereal voice orb: a translucent glass sphere with a slow rotating aurora
// and drifting blooms inside, wrapped in a soft glowing halo. It always breathes
// (CSS), and its live intensity tracks the agent's amplitude through two custom
// properties updated per frame in rAF — no React re-renders:
//   --lvl  smoothed 0..1 loudness (fast attack / slow decay) → scale + glow
//   --spk  0..1 "is clearly speaking" → extra brightness/warmth (speaking state)
// The breathing animation lives on a parent wrapper and the amplitude scale on a
// child, so they compose instead of fighting over `transform`.
function AgentOrb({
  getLevel,
  listening,
}: {
  getLevel: () => number;
  listening: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const listeningRef = useRef(listening);
  useEffect(() => {
    listeningRef.current = listening;
  }, [listening]);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

    let raf = 0;
    let smooth = 0;
    let phase = 0;
    const tick = () => {
      phase += 0.02;
      const raw = getLevel();
      // Fast attack, slow decay → a natural voice envelope (breath, not a meter).
      smooth += (raw - smooth) * (raw > smooth ? 0.45 : 0.08);

      // Gentle idle shimmer so the orb is alive in silence; held calmer while
      // the user is speaking (listening state) rather than reacting to room noise.
      const idleBase = listeningRef.current ? 0.05 : 0.07;
      const idleSwing = listeningRef.current ? 0.015 : 0.035;
      const idle = idleBase + Math.sin(phase) * idleSwing;

      let lvl = Math.max(idle, smooth);
      // "Speaking" once clearly above the idle floor → brighten/warm the orb.
      let spk = Math.max(0, Math.min(1, (smooth - 0.08) * 2.4));

      // Reduced motion: keep only a gentle, minimal pulse.
      if (reduce) {
        lvl = Math.min(lvl, 0.12);
        spk *= 0.35;
      }

      const el = rootRef.current;
      if (el) {
        el.style.setProperty("--lvl", lvl.toFixed(3));
        el.style.setProperty("--spk", spk.toFixed(3));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [getLevel]);

  return (
    <div className="my-7 flex justify-center">
      <div
        ref={rootRef}
        className="relative h-36 w-36"
        style={{ ["--lvl" as string]: 0, ["--spk" as string]: 0 } as React.CSSProperties}
      >
        {/* Outer bloom / halo — grows and brightens with the agent's voice */}
        <div
          className="absolute inset-[-34%] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(207,69,32,0.55) 0%, rgba(207,69,32,0.18) 42%, rgba(207,69,32,0) 68%)",
            filter: "blur(26px)",
            opacity: "calc(0.16 + var(--lvl) * 0.6 + var(--spk) * 0.22)",
            transform: "scale(calc(1 + var(--lvl) * 0.5))",
            willChange: "transform, opacity",
          }}
        />

        {/* Breathing wrapper (CSS animation) — separate element from the
            amplitude scale so the two transforms compose, not collide. */}
        <div className="orb-breathe absolute inset-0">
          {/* Amplitude scale wrapper */}
          <div
            className="absolute inset-0"
            style={{
              transform: "scale(calc(1 + var(--lvl) * 0.2))",
              willChange: "transform",
            }}
          >
            {/* Glass sphere */}
            <div
              className="absolute inset-0 overflow-hidden rounded-full"
              style={{
                background:
                  "radial-gradient(circle at 36% 28%, #fff0dc 0%, #f0935f 40%, #c5481f 74%, #8f2c0c 100%)",
                boxShadow:
                  "0 22px 55px -12px rgba(168,53,15,0.55), inset 0 0 36px rgba(255,224,190,0.4), inset 0 -18px 34px rgba(110,26,6,0.55)",
                filter:
                  "saturate(calc(1 + var(--spk) * 0.5)) brightness(calc(1 + var(--spk) * 0.22))",
              }}
            >
              {/* Slow rotating aurora — the ethereal swirl */}
              <div
                className="orb-spin-slow absolute inset-[-25%]"
                style={{
                  mixBlendMode: "screen",
                  filter: "blur(14px)",
                  opacity: "calc(0.3 + var(--lvl) * 0.4 + var(--spk) * 0.3)",
                  background:
                    "conic-gradient(from 0deg, rgba(255,211,107,0.0), rgba(255,211,107,0.7), rgba(54,169,138,0.55), rgba(255,138,92,0.7), rgba(255,211,107,0.0))",
                }}
              />

              {/* Drifting blooms (iridescence) */}
              <div
                className="absolute inset-0"
                style={{
                  mixBlendMode: "screen",
                  filter: "blur(11px)",
                  opacity: "calc(0.38 + var(--lvl) * 0.5)",
                }}
              >
                <div
                  className="orb-blob-a absolute inset-0"
                  style={{
                    background:
                      "radial-gradient(42% 42% at 38% 34%, #ffd36b, transparent 70%)",
                  }}
                />
                <div
                  className="orb-blob-b absolute inset-0"
                  style={{
                    background:
                      "radial-gradient(46% 46% at 62% 64%, #36a98a, transparent 70%)",
                  }}
                />
                <div
                  className="orb-blob-c absolute inset-0"
                  style={{
                    background:
                      "radial-gradient(40% 40% at 64% 30%, #ff8a5c, transparent 72%)",
                  }}
                />
              </div>

              {/* Inner core glow — flares with the speaking level */}
              <div
                className="absolute inset-[18%] rounded-full"
                style={{
                  background:
                    "radial-gradient(circle, rgba(255,240,214,0.95), rgba(255,200,150,0.25) 55%, transparent 72%)",
                  filter: "blur(6px)",
                  opacity: "calc(0.25 + var(--spk) * 0.7)",
                  transform: "scale(calc(0.85 + var(--lvl) * 0.4))",
                  willChange: "transform, opacity",
                }}
              />

              {/* Specular highlight */}
              <div
                className="absolute left-[24%] top-[16%] h-1/4 w-1/3 rounded-full"
                style={{
                  background:
                    "radial-gradient(circle, rgba(255,255,255,0.92), transparent 70%)",
                  filter: "blur(5px)",
                }}
              />
            </div>
          </div>
        </div>

        {/* Listening rim: a soft cool halo while the USER is speaking — a
            distinct, calmer shimmer vs. the warm speaking pulse. */}
        <div
          className="pointer-events-none absolute inset-[-6%] rounded-full transition-opacity duration-300"
          style={{
            opacity: listening ? 1 : 0,
            boxShadow:
              "0 0 0 2px rgba(31,93,76,0.28), 0 0 26px rgba(31,93,76,0.3)",
          }}
        />
      </div>
    </div>
  );
}

export type AppealState =
  | { status: "drafting" }
  | { status: "ready"; letter: string }
  | { status: "error"; error: string };

export type SummaryState =
  | { status: "drafting" }
  | { status: "ready"; summary: string }
  | { status: "error"; error: string };

export default function VoicePanel({
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
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [talking, setTalking] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const playerRef = useRef<PcmPlayer | null>(null);
  const micRef = useRef<{
    ctx: AudioContext;
    stream: MediaStream;
    processor: ScriptProcessorNode;
  } | null>(null);
  const sendingRef = useRef(false); // true while a held utterance is streaming
  const stoppingRef = useRef(false); // guards the tail-flush on release
  const agentTurnRef = useRef<string>(""); // accumulates current agent transcript

  // The WS handler is bound once at connect; keep latest disputes in a ref so
  // draft_appeal always sends the current set.
  const disputedIdsRef = useRef(disputedIds);
  useEffect(() => {
    disputedIdsRef.current = disputedIds;
  }, [disputedIds]);

  const send = (msg: unknown) => wsRef.current?.send(JSON.stringify(msg));

  const draftAppeal = () => {
    const bill = parse as BillParse;
    if (!analysis || !onAppeal) return;
    runDraftAppeal({
      analysis,
      service_date: bill.service_date,
      disputedIds: disputedIdsRef.current,
      patient_name: bill.patient_name,
      onAppeal,
    });
  };

  const generateSummary = () => {
    if (!onSummary) return;
    runGenerateSummary({ parse: parse as DischargeParse, onSummary });
  };

  const appendAgentText = (delta: string) => {
    agentTurnRef.current += delta;
    setTurns((prev) => {
      const next = [...prev];
      if (next.length && next[next.length - 1].role === "agent") {
        next[next.length - 1] = { role: "agent", text: agentTurnRef.current };
      } else {
        next.push({ role: "agent", text: agentTurnRef.current });
      }
      return next;
    });
  };

  const handleEvent = useCallback(
    (evt: { type: string; [k: string]: unknown }) => {
      const t = evt.type;

      // Agent audio chunk -> play it.
      if (t === "response.output_audio.delta" || t.endsWith("audio.delta")) {
        const b64 = (evt.delta ?? evt.audio) as string | undefined;
        if (b64) playerRef.current?.enqueue(b64);
        return;
      }

      // Agent transcript (spoken words as text).
      if (t.includes("audio_transcript") && t.endsWith("delta")) {
        appendAgentText((evt.delta as string) ?? "");
        return;
      }

      // User speech transcript.
      if (t.includes("input_audio_transcription")) {
        const text = (evt.transcript ?? evt.delta) as string | undefined;
        if (text && t.endsWith("completed")) {
          setTurns((prev) => [...prev, { role: "user", text }]);
        }
        return;
      }

      // End of an agent response -> start a fresh agent turn next time.
      if (t === "response.done" || t === "response.completed") {
        agentTurnRef.current = "";
        return;
      }

      // Tool / function call.
      if (t === "response.function_call_arguments.done") {
        const name = evt.name as string;
        const callId = evt.call_id as string;
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse((evt.arguments as string) || "{}");
        } catch {}
        let output: unknown = { ok: true };

        if (name === "mark_disputed" && typeof args.line_id === "number") {
          onMarkDisputed?.(args.line_id);
          output = { ok: true, line_id: args.line_id, status: "marked_disputed" };
        } else if (name === "draft_appeal") {
          draftAppeal(); // async; renders on screen when ready
          output = {
            ok: true,
            status: "drafting",
            message:
              "The appeal letter is being prepared and will appear on the patient's screen.",
          };
        } else if (name === "generate_summary") {
          generateSummary(); // async; renders on screen when ready
          output = {
            ok: true,
            status: "drafting",
            message:
              "The medication schedule and questions are being prepared and will appear on the patient's screen.",
          };
        } else {
          output = { ok: false, error: `tool ${name} not available` };
        }

        send({
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: callId,
            output: JSON.stringify(output),
          },
        });
        send({ type: "response.create" });
        return;
      }

      if (t === "error") {
        console.error("realtime error", evt);
        setError(JSON.stringify(evt.error ?? evt));
        return;
      }

      // Anything else: log for debugging during the live test.
      console.debug("realtime event", t, evt);
    },
    [onMarkDisputed],
  );

  const connect = async () => {
    setError(null);
    setStatus("connecting");
    try {
      const res = await fetch("/api/realtime-token", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "token mint failed");

      const player = new PcmPlayer();
      player.resume();
      playerRef.current = player;

      const ws = new WebSocket(
        `wss://api.x.ai/v1/realtime?model=${VOICE_MODEL}`,
        [`xai-client-secret.${data.token}`],
      );
      wsRef.current = ws;

      ws.onopen = () => {
        const { instructions, tools } = buildVoiceSession(docType, parse, {
          analysis,
        });
        send({
          type: "session.update",
          session: {
            instructions,
            voice: VOICE_NAME,
            turn_detection: null, // push-to-talk
            audio: {
              input: { format: { type: "audio/pcm", rate: SAMPLE_RATE } },
              output: { format: { type: "audio/pcm", rate: SAMPLE_RATE } },
            },
            tools,
          },
        });
        setStatus("connected");
        initMic(); // pre-warm the mic so the first word isn't clipped
      };
      ws.onmessage = (e) => handleEvent(JSON.parse(e.data));
      ws.onerror = () => {
        setError("WebSocket error");
        setStatus("error");
      };
      ws.onclose = () => setStatus("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "connect failed");
      setStatus("error");
    }
  };

  // Acquire the mic ONCE and keep it hot; streaming is gated by sendingRef so
  // there's no getUserMedia/AudioContext startup latency clipping the first word.
  const initMic = async () => {
    if (micRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processor.onaudioprocess = (e) => {
        if (!sendingRef.current) return;
        // iOS/Safari may run the mic at 48kHz despite the 24kHz request, so
        // downsample to what the realtime session expects.
        const frame = resampleTo24k(
          e.inputBuffer.getChannelData(0),
          e.inputBuffer.sampleRate,
        );
        send({
          type: "input_audio_buffer.append",
          audio: floatToPcm16Base64(frame),
        });
      };
      source.connect(processor);
      processor.connect(ctx.destination);
      micRef.current = { ctx, stream, processor };
    } catch {
      setError("Microphone permission denied");
    }
  };

  const startTalking = () => {
    if (status !== "connected" || sendingRef.current) return;
    if (micRef.current?.ctx.state === "suspended") micRef.current.ctx.resume();
    playerRef.current?.clear(); // stop the agent if it's mid-sentence
    sendingRef.current = true;
    setTalking(true);
  };

  // Keep streaming ~250ms past release so the tail of the word isn't dropped,
  // then commit the turn and ask for a response.
  const stopTalking = () => {
    if (!sendingRef.current || stoppingRef.current) return;
    stoppingRef.current = true;
    setTalking(false);
    setTimeout(() => {
      sendingRef.current = false;
      stoppingRef.current = false;
      send({ type: "input_audio_buffer.commit" });
      send({ type: "response.create" });
    }, 250);
  };

  useEffect(() => {
    return () => {
      wsRef.current?.close();
      micRef.current?.stream.getTracks().forEach((tr) => tr.stop());
      micRef.current?.ctx.close();
      playerRef.current?.close();
    };
  }, []);

  const disputedSet = new Set(disputedIds);
  const getLevel = useCallback(() => playerRef.current?.level() ?? 0, []);

  return (
    <div className="rise mt-6 border border-line bg-paper-raised p-6">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft">
          Talk to your advocate
        </p>
        <span
          className={`font-mono text-[11px] uppercase tracking-[0.2em] ${
            status === "connected"
              ? "text-seal"
              : status === "error"
                ? "text-accent-deep"
                : "text-ink-soft"
          }`}
        >
          ● {status}
        </span>
      </div>

      {status !== "connected" ? (
        <button
          onClick={connect}
          disabled={status === "connecting"}
          className="mt-4 w-full bg-ink px-4 py-3.5 font-mono text-sm uppercase tracking-[0.2em] text-paper transition-all hover:bg-accent disabled:opacity-50"
        >
          {status === "connecting" ? "Connecting…" : "Connect voice agent"}
        </button>
      ) : (
        <>
        <AgentOrb getLevel={getLevel} listening={talking} />
        <button
          onPointerDown={(e) => {
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            startTalking();
          }}
          onPointerUp={stopTalking}
          onPointerCancel={stopTalking}
          className={`mt-4 flex w-full touch-none select-none items-center justify-center gap-2.5 px-4 py-5 font-mono text-sm uppercase tracking-[0.2em] text-paper transition-all ${
            talking ? "bg-accent-deep" : "bg-accent hover:bg-accent-deep"
          }`}
        >
          <MicIcon className="h-3.5 w-3.5 shrink-0 opacity-90" />
          {talking ? "● Listening — release to send" : "Hold to talk"}
        </button>
        </>
      )}

      {error && (
        <p className="mt-3 border-l-2 border-accent bg-paper px-3 py-2 font-mono text-xs text-accent-deep">
          {error}
        </p>
      )}

      {/* Live transcript */}
      {turns.length > 0 && (
        <div className="mt-5 max-h-72 space-y-3 overflow-y-auto">
          {turns.map((turn, i) => (
            <div key={i}>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
                {turn.role === "user" ? "You" : "Advocate"}
              </p>
              <p className="mt-0.5 text-sm leading-relaxed text-ink">{turn.text}</p>
            </div>
          ))}
        </div>
      )}

      {/* Disputed lines (bill only) */}
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
