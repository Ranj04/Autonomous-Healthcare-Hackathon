// Phase 4 automated smoke test: mint an ephemeral token, open the realtime
// WebSocket, send the same session.update the app sends, and confirm xAI
// accepts the model + voice + tools + audio config (i.e. session.updated, no error).
// This validates everything except the live mic (the human's part of the gate).
// Usage: node scripts/verify-voice.mjs   (dev server must be running on :3000)

import WebSocket from "ws";
import { readFileSync } from "node:fs";

const env = readFileSync(".env.local", "utf8");
const KEY = env.match(/XAI_API_KEY=(.+)/)?.[1]?.trim();
if (!KEY) throw new Error("no XAI_API_KEY");

const MODEL = "grok-voice-think-fast-1.0";

// 1) mint ephemeral token via OUR server route
const tokRes = await fetch("http://localhost:3000/api/realtime-token", { method: "POST" });
const tok = await tokRes.json();
if (!tokRes.ok) throw new Error("token route failed: " + JSON.stringify(tok));
console.log("✓ ephemeral token minted via /api/realtime-token");

// 2) open WS with the browser-style subprotocol auth
const ws = new WebSocket(`wss://api.x.ai/v1/realtime?model=${MODEL}`, [
  `xai-client-secret.${tok.token}`,
]);

let pass = false;
const timeout = setTimeout(() => {
  console.log("❌ timed out waiting for session.updated");
  ws.close();
  process.exit(1);
}, 15000);

ws.on("open", () => {
  console.log("✓ WebSocket open with ephemeral subprotocol auth");
  ws.send(
    JSON.stringify({
      type: "session.update",
      session: {
        instructions: "You are a calm patient billing advocate. Be brief.",
        voice: "ara",
        turn_detection: null,
        audio: {
          input: { format: { type: "audio/pcm", rate: 24000 } },
          output: { format: { type: "audio/pcm", rate: 24000 } },
        },
        tools: [
          {
            type: "function",
            name: "mark_disputed",
            description: "Record a disputed line.",
            parameters: {
              type: "object",
              properties: { line_id: { type: "integer" } },
              required: ["line_id"],
            },
          },
        ],
      },
    }),
  );
});

ws.on("message", (raw) => {
  const evt = JSON.parse(raw.toString());
  if (evt.type === "session.updated" || evt.type === "session.created") {
    console.log(`✓ received ${evt.type} — session config accepted`);
    console.log("  voice:", evt.session?.voice, "| model:", evt.session?.model ?? MODEL);
    if (evt.type === "session.updated") {
      pass = true;
      clearTimeout(timeout);
      ws.close();
    }
  } else if (evt.type === "error") {
    console.log("❌ realtime error:", JSON.stringify(evt.error ?? evt));
    clearTimeout(timeout);
    ws.close();
    process.exit(1);
  } else {
    console.log("  event:", evt.type);
  }
});

ws.on("close", () => {
  console.log(pass ? "\n✅ VOICE SESSION HANDSHAKE OK" : "\n❌ handshake incomplete");
  process.exit(pass ? 0 : 1);
});

ws.on("error", (e) => {
  console.log("❌ ws error:", e.message);
  process.exit(1);
});
