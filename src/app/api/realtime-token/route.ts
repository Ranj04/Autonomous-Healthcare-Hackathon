import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Mint a short-lived ephemeral client secret so the browser can open the
// realtime WebSocket without ever seeing the real XAI_API_KEY.
export async function POST() {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "XAI_API_KEY is not set" }, { status: 500 });
  }

  const res = await fetch("https://api.x.ai/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ expires_after: { seconds: 300 } }),
  });

  if (!res.ok) {
    const detail = await res.text();
    return NextResponse.json({ error: `xAI ${res.status}: ${detail}` }, { status: 500 });
  }

  const data = (await res.json()) as { value: string; expires_at: number };
  return NextResponse.json({ token: data.value, expires_at: data.expires_at });
}
