// Thin client for the xAI Responses API (vision + chat).
// Endpoint and model confirmed from docs.x.ai (image-understanding guide).

export const XAI_VISION_MODEL = "grok-4.3";
// Text chat model for the typed-conversation path. Same family as vision; the
// docs (docs.x.ai) recommend grok-4.3 for general chat + tool calling.
export const XAI_CHAT_MODEL = "grok-4.3";

type ContentPart =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string; detail?: "high" | "low" | "auto" };

// Call the Responses API with text + images and return the model's text output.
export async function xaiVision(
  systemText: string,
  userText: string,
  imageDataUrls: string[],
): Promise<string> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) throw new Error("XAI_API_KEY is not set");

  const content: ContentPart[] = [
    { type: "input_text", text: userText },
    ...imageDataUrls.map(
      (url): ContentPart => ({ type: "input_image", image_url: url, detail: "high" }),
    ),
  ];

  const res = await fetch("https://api.x.ai/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: XAI_VISION_MODEL,
      instructions: systemText,
      input: [{ role: "user", content }],
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`xAI ${res.status}: ${detail}`);
  }

  const data = await res.json();
  return extractText(data);
}

// Pull the concatenated text out of a Responses API payload.
function extractText(data: unknown): string {
  const d = data as {
    output_text?: string;
    output?: { content?: { type?: string; text?: string }[] }[];
  };
  if (typeof d.output_text === "string" && d.output_text.length) {
    return d.output_text;
  }
  const parts: string[] = [];
  for (const item of d.output ?? []) {
    for (const c of item.content ?? []) {
      if (c.type === "output_text" && c.text) parts.push(c.text);
    }
  }
  return parts.join("");
}

// Text-only chat call (used for drafting the appeal letter).
export async function xaiChat(systemText: string, userText: string): Promise<string> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) throw new Error("XAI_API_KEY is not set");

  const res = await fetch("https://api.x.ai/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: XAI_CHAT_MODEL,
      instructions: systemText,
      input: [{ role: "user", content: [{ type: "input_text", text: userText }] }],
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`xAI ${res.status}: ${detail}`);
  }
  return extractText(await res.json());
}

// Models sometimes wrap JSON in ```json fences; strip them and parse.
export function parseJsonFromModel<T>(text: string): T {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  return JSON.parse(cleaned) as T;
}
