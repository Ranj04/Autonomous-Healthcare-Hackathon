# Paperwork Advocate

A voice-first patient advocate for the paperwork the healthcare system buries patients in. Upload a **medical bill** or **discharge / after-visit instructions**, and the app reads the document, audits it, and lets you argue your case — out loud or by typing.

- **Medical bills** → every charge is read off the page and audited against a fair-price benchmark table. Overcharges and same-date duplicates are flagged, and a real-time voice advocate walks you through the lines, marks the ones you don't recall, and drafts a formal appeal letter you can download as a PDF.
- **Discharge instructions** → the diagnosis, medications, follow-ups, warning signs, and activity restrictions are extracted, expanded into a daily medication schedule, and explained by a calm health navigator that can produce a plain-language after-visit summary and a list of questions for your next visit.

## Tech stack

| Layer | Choice |
|------|--------|
| Framework | **Next.js 16** (App Router, React Server Components) on **React 19** |
| Language | **TypeScript 5** |
| Styling | **Tailwind CSS v4** (PostCSS plugin), custom "case file" paper theme, `next/font` (Fraunces + IBM Plex Mono) |
| AI — vision & chat | **xAI Grok** (`grok-4.3`) via the Responses API for document parsing, appeal drafting, and the typed advocate |
| AI — voice | **xAI Grok Realtime** (`grok-voice-think-fast-1.0`) over a browser WebSocket, with server-minted ephemeral client secrets |
| PDF / image | `pdf-to-img` (+ `@napi-rs/canvas` polyfills) to rasterize PDFs to PNG; `jspdf` to export appeal letters and summaries |
| Native shell | Standalone **SwiftUI + WebKit** iOS wrapper (`/ios`), iOS 16+ |
| Tooling | ESLint 9 (`eslint-config-next`), `tsx` for verify scripts |

## Architecture

The core design principle is a strict split between the **LLM** (reads messy documents, writes prose) and **deterministic code** (does the math). The model never decides whether you were overcharged or invents a price — those come from plain TypeScript joined to a fair-price table. This is the anti-hallucination guarantee.

```
Upload (PDF/image)
  └─ POST /api/upload
       ├─ images.ts        rasterize PDF → PNG data URLs
       ├─ parse.ts         Grok vision → structured JSON (docType-keyed)
       └─ bill:      overcharge.ts  → deterministic audit vs reference.json
          discharge: schedule.ts    → deterministic daily med schedule
                                                   │
                                                   ▼
                                          page.tsx renders results
                                                   │
                           ┌───────────────────────┴───────────────────────┐
                        Talk (voice)                                  Type (text)
                     VoicePanel.tsx                                 TextPanel.tsx
                  POST /api/realtime-token                       POST /api/chat
                  → WebSocket to Grok Realtime                   → Grok Responses API
                           └──────────── shared session (voice-context.ts) ─────────────┘
                              same system prompt, injected context, and tools
                                                   │
                              tool calls ──────────┼────────────────────
                              mark_disputed   draft_appeal      generate_summary
                                              POST /api/appeal   POST /api/summary
```

### Document type is threaded everywhere

A single `docType` (`"bill" | "discharge"`) is threaded through parse → process → voice/text → output. Each stage dispatches on it, so the two document flows share one shell and differ only in their prompt, the context injected into the model, and the tools exposed.

### Voice and text are the same agent in two modalities

`voice-context.ts` builds one session definition — instructions, injected document context, and tool schemas. The **voice** path (`VoicePanel`) feeds it to the Grok Realtime WebSocket; the **text** path (`/api/chat`) feeds the identical definition to the Responses API. The typed advocate therefore behaves the same as the spoken one — only the transport differs.

### Tools drive the on-screen UI

The agent acts through three function tools, handled client-side:

- `mark_disputed(line_id)` — flag a bill line the patient doesn't recall.
- `draft_appeal()` — generate the formal appeal letter (`/api/appeal`, exact figures from the deterministic analysis).
- `generate_summary()` — produce a medication schedule + follow-up questions for a discharge (`/api/summary`).

### Key directories

```
src/
  app/
    page.tsx               Intake form + results (overcharge table / discharge view)
    layout.tsx             Fonts, metadata, How-it-works drawer
    api/
      upload/              Parse + analyze an uploaded document
      realtime-token/      Mint short-lived xAI realtime client secret (keeps key server-side)
      chat/                One typed advocate turn (Responses API)
      appeal/              Draft the appeal letter
      summary/             Draft the after-visit summary
  components/
    VoicePanel.tsx         Realtime WebSocket, push-to-talk, audio-reactive voice orb
    TextPanel.tsx          Typed advocate, same tools as voice
    HowItWorks.tsx         Explainer drawer
  lib/
    types.ts               Shared engine types (the docType contract)
    xai.ts                 Thin xAI Responses client (vision + chat) + JSON extraction
    voice-context.ts       Per-docType system prompts, context, and tool schemas
    parse.ts               Grok vision → structured BillParse / DischargeParse
    overcharge.ts          Deterministic overcharge + duplicate audit
    schedule.ts            Deterministic medication schedule
    appeal.ts / summary.ts Letter / summary drafting (figures handed in, prose out)
    audio.ts               PCM16 resample + playback for the realtime stream
    images.ts              PDF → PNG rasterization with serverless polyfills
data/                      Synthetic fair-price table + ground-truth (see data/README.md)
scripts/                   verify-*.{ts,mjs} gates for parse / overcharge / appeal / etc.
ios/                       Standalone SwiftUI + WebKit wrapper app (see ios/README.md)
```

## Getting started

Requires Node.js and an [xAI API key](https://console.x.ai).

```bash
# 1. Configure your key
cp .env.example .env.local
# then edit .env.local and set XAI_API_KEY=...

# 2. Install and run
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), choose a document type, upload a bill or discharge PDF/image, and either **Talk** or **Type** to your advocate. Sample documents live in `public/test-bills/`.

### Scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |

The `scripts/verify-*` files are standalone verify gates (run with `tsx`/`node`) that check parsing, overcharge math, scheduling, appeal drafting, and the voice/text flows against the synthetic ground-truth in `data/`.

## iOS app

`/ios` contains a thin, fully standalone SwiftUI + WebKit wrapper that loads the deployed web app full-screen and holds **no API keys** (every xAI call stays server-side). Voice requires a physical device, since the simulator has no microphone. See [`ios/README.md`](ios/README.md).

## Notes

- This repo pins **Next.js 16**, which has breaking changes from earlier versions — consult the bundled guides in `node_modules/next/dist/docs/` before editing (see `AGENTS.md`).
- Synthetic data only. Never place real patient data (PHI) in `data/` or the repo.
