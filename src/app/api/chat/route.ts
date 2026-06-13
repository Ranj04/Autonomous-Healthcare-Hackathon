import { NextRequest, NextResponse } from "next/server";
import type {
  BillAnalysis,
  BillParse,
  DischargeParse,
  DocType,
} from "@/lib/types";
import { buildVoiceSession } from "@/lib/voice-context";
import { XAI_CHAT_MODEL } from "@/lib/xai";

export const runtime = "nodejs";
export const maxDuration = 60;

// Text-chat turn. Stateless: the client sends the full conversation as the
// Responses `input` array and we relay one model call. Same docType-keyed
// instructions and the same tools as the voice path (via buildVoiceSession),
// so the typed advocate behaves identically — only the modality differs.
export async function POST(req: NextRequest) {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "XAI_API_KEY is not set" }, { status: 500 });
  }

  try {
    const { docType, parse, analysis, input } = (await req.json()) as {
      docType: DocType;
      parse: BillParse | DischargeParse;
      analysis?: BillAnalysis;
      input: unknown[];
    };

    const { instructions, tools } = buildVoiceSession(docType, parse, { analysis });

    const res = await fetch("https://api.x.ai/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: XAI_CHAT_MODEL,
        instructions,
        input,
        tools,
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      return NextResponse.json(
        { error: `xAI ${res.status}: ${detail}` },
        { status: 500 },
      );
    }

    const data = (await res.json()) as {
      output?: unknown[];
      output_text?: string;
    };

    // Return the raw output items so the client can append them to its history
    // verbatim and drive the tool loop, plus the assistant text for display.
    return NextResponse.json({
      output: data.output ?? [],
      output_text: data.output_text ?? "",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "chat turn failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
