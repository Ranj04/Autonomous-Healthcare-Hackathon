import { NextRequest, NextResponse } from "next/server";
import type { DocType } from "@/lib/types";
import { fileToImageDataUrls } from "@/lib/images";
import { parseDocument } from "@/lib/parse";
import { analyzeBill } from "@/lib/overcharge";
import { buildSchedule } from "@/lib/schedule";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");
  const docType = form.get("docType") as DocType;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  try {
    const images = await fileToImageDataUrls(file);
    const meta = { received: file.name, bytes: file.size, docType };

    if (docType === "discharge") {
      const parsed = await parseDocument("discharge", images);
      const schedule = buildSchedule(parsed);
      return NextResponse.json({ ...meta, parsed, schedule });
    }

    const parsed = await parseDocument("bill", images);
    const analysis = analyzeBill(parsed);
    return NextResponse.json({ ...meta, parsed, analysis });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Parse failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
