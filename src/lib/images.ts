// Grok vision accepts JPEG/PNG only. Turn an uploaded file (PDF or image)
// into one or more base64 PNG/JPEG data URLs the Responses API can read.

type PdfFn = (typeof import("pdf-to-img"))["pdf"];

// pdfjs-dist (loaded by pdf-to-img) references browser globals — DOMMatrix,
// Path2D, ImageData — at module-eval time. Node has no DOM, so on a serverless
// runtime (Vercel) the import throws "DOMMatrix is not defined" and every PDF
// upload 500s. Polyfill those globals from @napi-rs/canvas (already a pdf-to-img
// dependency) BEFORE dynamically importing pdf-to-img, so the order is
// guaranteed. Cached so the work happens once per warm instance.
let pdfLoader: Promise<PdfFn> | null = null;
function loadPdf(): Promise<PdfFn> {
  pdfLoader ??= (async () => {
    const canvas = await import("@napi-rs/canvas");
    const g = globalThis as Record<string, unknown>;
    g.DOMMatrix ??= canvas.DOMMatrix;
    g.Path2D ??= canvas.Path2D;
    g.ImageData ??= canvas.ImageData;
    const { pdf } = await import("pdf-to-img");
    return pdf;
  })();
  return pdfLoader;
}

export async function fileToImageDataUrls(file: File): Promise<string[]> {
  const buf = Buffer.from(await file.arrayBuffer());

  if (file.type === "application/pdf") {
    const pdf = await loadPdf();
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
