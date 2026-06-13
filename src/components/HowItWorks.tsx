"use client";

import { useEffect, useRef, useState } from "react";

export default function HowItWorks() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Close on Escape; move focus into the panel when it opens.
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {/* Edge tab */}
      <button
        type="button"
        aria-label="How this works"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="fixed right-0 top-1/2 z-40 flex -translate-y-1/2 flex-col items-center gap-1 border border-r-0 border-line bg-paper-raised px-2.5 py-4 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft shadow-[-3px_3px_0_0_rgba(33,28,24,0.08)] transition-colors hover:bg-accent hover:text-paper hover:border-accent"
      >
        <span>How</span>
        <span>it</span>
        <span>works</span>
      </button>

      {/* Click-outside scrim */}
      <div
        onClick={() => setOpen(false)}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-ink/20 transition-opacity duration-200 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* Slide-out panel */}
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="How this works"
        className={`fixed right-0 top-0 z-50 flex h-full w-[340px] max-w-[88vw] flex-col border-l border-line bg-paper-raised shadow-[-8px_0_24px_0_rgba(33,28,24,0.12)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-start justify-between border-b border-line px-6 py-5">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-accent">
              Case File
            </p>
            <h2 className="mt-1 font-display text-2xl font-light tracking-tight text-ink">
              How this works
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="-mr-1 -mt-1 border border-line bg-paper px-2.5 py-1 font-mono text-sm text-ink-soft transition-colors hover:bg-accent hover:text-paper hover:border-accent"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 font-mono text-sm leading-relaxed text-ink-soft">
          <p className="text-ink">
            Medical paperwork is confusing. This app helps you understand it —
            and actually do something about it — just by talking.
          </p>

          <ol className="mt-6 space-y-5">
            <li>
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
                01
              </span>
              <p className="mt-1">
                <span className="text-ink">Upload it.</span> Add a medical bill
                or your discharge instructions.
              </p>
            </li>
            <li>
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
                02
              </span>
              <p className="mt-1">
                <span className="text-ink">We read it.</span> The app pulls out
                the details — charges and codes on a bill, or medications and
                follow-ups on discharge paperwork.
              </p>
            </li>
            <li>
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
                03
              </span>
              <p className="mt-1">
                <span className="text-ink">Talk to it.</span> Ask anything out
                loud, in your language.{" "}
                <span className="italic">
                  &ldquo;Why is this so expensive?&rdquo; &ldquo;Did I get
                  charged twice?&rdquo; &ldquo;What is this medication
                  for?&rdquo;
                </span>
              </p>
            </li>
            <li>
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
                04
              </span>
              <p className="mt-1">
                <span className="text-ink">Get something useful.</span> For a
                bill, we flag likely overcharges and write an appeal letter you
                can send. For discharge papers, we explain your instructions and
                build a simple medication schedule.
              </p>
            </li>
          </ol>

          <div className="mt-7 border-l-2 border-seal bg-paper px-4 py-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-seal">
              Why you can trust the numbers
            </p>
            <p className="mt-1.5">
              We check every charge against a reference list of fair prices
              instead of guessing — so the app never makes up a price.
            </p>
          </div>

          <div className="mt-5 border-l-2 border-accent bg-paper px-4 py-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent-deep">
              A note
            </p>
            <p className="mt-1.5">
              This is a demo. Please use the sample documents provided.
              Don&apos;t upload real bills or personal health information.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
