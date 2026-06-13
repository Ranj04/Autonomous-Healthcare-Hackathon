import { pdf } from "pdf-to-img";

// Grok vision accepts JPEG/PNG only. Turn an uploaded file (PDF or image)
// into one or more base64 PNG/JPEG data URLs the Responses API can read.
export async function fileToImageDataUrls(file: File): Promise<string[]> {
  const buf = Buffer.from(await file.arrayBuffer());

  if (file.type === "application/pdf") {
    const doc = await pdf(buf, { scale: 2 });
    const urls: string[] = [];
    for await (const page of doc) {
      urls.push(`data:image/png;base64,${page.toString("base64")}`);
    }
    return urls;
  }

  // Already an image — pass it straight through.
  const mime = file.type || "image/png";
  return [`data:${mime};base64,${buf.toString("base64")}`];
}
