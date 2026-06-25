import { GoogleGenAI } from "@google/genai";

// GAP-2: shared AI helper. One place that knows about the LLM provider (Google
// Gemini — already used by the menu importer) so every AI feature degrades the same
// way: when GEMINI_API_KEY isn't set, isAiConfigured() is false and callers show a
// "not configured" state instead of failing. Server-only.

const DEFAULT_MODEL = "gemini-2.5-flash";

export function isAiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

function client(): GoogleGenAI {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not configured");
  return new GoogleGenAI({ apiKey: key });
}

function stripFences(s: string): string {
  return s.trim().replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/\s*```$/, "").trim();
}

// Free-text generation. Returns the model's text (trimmed).
export async function generateText(prompt: string, opts?: { model?: string; system?: string }): Promise<string> {
  const ai = client();
  const contents = opts?.system ? opts.system + "\n\n" + prompt : prompt;
  const res = await ai.models.generateContent({ model: opts?.model || DEFAULT_MODEL, contents });
  return (res.text ?? res.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
}

// Strict JSON generation. The model is asked for application/json; the result is
// parsed and returned. Throws if the response can't be parsed as JSON.
export async function generateJson<T = unknown>(prompt: string, opts?: { model?: string; system?: string }): Promise<T> {
  const ai = client();
  const contents = opts?.system ? opts.system + "\n\n" + prompt : prompt;
  const res = await ai.models.generateContent({
    model: opts?.model || DEFAULT_MODEL,
    contents,
    config: { responseMimeType: "application/json" },
  });
  const raw = res.text ?? res.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  try {
    return JSON.parse(stripFences(raw)) as T;
  } catch {
    throw new Error("The AI response could not be read.");
  }
}
