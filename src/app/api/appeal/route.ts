import { NextRequest, NextResponse } from "next/server";
import type { BillAnalysis } from "@/lib/types";
import { draftAppealLetter } from "@/lib/appeal";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      analysis: BillAnalysis;
      service_date?: string;
      disputedIds: number[];
      patient_name?: string;
    };
    const letter = await draftAppealLetter(
      body.analysis,
      body.service_date,
      body.disputedIds ?? [],
      body.patient_name,
    );
    return NextResponse.json({ letter });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Appeal draft failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
