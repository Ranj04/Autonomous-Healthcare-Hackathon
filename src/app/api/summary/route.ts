import { NextRequest, NextResponse } from "next/server";
import type { DischargeParse } from "@/lib/types";
import { draftVisitSummary } from "@/lib/summary";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { parse } = (await req.json()) as { parse: DischargeParse };
    const summary = await draftVisitSummary(parse);
    return NextResponse.json({ summary });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Summary generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
