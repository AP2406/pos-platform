import { GoogleGenAI } from "@google/genai";
import mammoth from "mammoth";
import * as XLSX from "xlsx";

export type ParsedMenuItem = {
  name: string;
  price: number | null;
  category: string | null;
};

const MENU_PROMPT =
  "You extract a clean product/menu catalog from a restaurant or retail menu. " +
  "The source may be a photo, a PDF, a Word document, a spreadsheet, or plain text. " +
  "Return ONLY a JSON object of this exact shape, with no markdown and no commentary:\n\n" +
  '{ "items": [ { "name": string, "price": number or null, "category": string or null } ] }\n\n' +
  "Rules:\n" +
  "- One entry per sellable item.\n" +
  "- name: the item name as printed. Required. Skip rows that are not real items (headers, page numbers, descriptions with no item).\n" +
  "- price: the numeric dollar value only (e.g. \"$12.50\" becomes 12.50). Use null if no clear price.\n" +
  "- category: the menu section the item sits under (e.g. \"Appetizers\", \"Drinks\") if one is shown, otherwise null.\n" +
  "- Do NOT invent items, prices, or categories. If something is unclear, use null.\n" +
  "- Ignore prices written as ranges or per-unit notes you cannot resolve to a single number; use null in that case.\n" +
  "- Return ONLY the JSON object.";

function detectKind(
  name: string,
  mimeType: string
): "image" | "pdf" | "docx" | "spreadsheet" | "text" | "unsupported" {
  const lower = (name || "").toLowerCase();
  const mt = (mimeType || "").toLowerCase();
  if (mt.indexOf("image/") === 0) return "image";
  if (mt === "application/pdf" || lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".docx") || mt.indexOf("wordprocessingml") !== -1) return "docx";
  if (
    lower.endsWith(".xlsx") ||
    lower.endsWith(".xls") ||
    mt.indexOf("spreadsheet") !== -1 ||
    mt.indexOf("ms-excel") !== -1
  ) {
    return "spreadsheet";
  }
  if (lower.endsWith(".csv") || mt === "text/csv") return "text";
  if (lower.endsWith(".txt") || mt.indexOf("text/") === 0) return "text";
  return "unsupported";
}

export async function extractMenuItems(file: {
  name: string;
  mimeType: string;
  base64: string;
}): Promise<ParsedMenuItem[]> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY not configured");
  }
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const kind = detectKind(file.name, file.mimeType);

  if (kind === "unsupported") {
    throw new Error(
      "That file type isn't supported. Try a PDF, a photo, a .docx, a spreadsheet, or a CSV. (Old .doc files should be saved as .docx or PDF first.)"
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let contents: any;

  if (kind === "image" || kind === "pdf") {
    const mimeType =
      kind === "pdf" ? "application/pdf" : file.mimeType || "image/jpeg";
    contents = [
      { text: MENU_PROMPT },
      { inlineData: { mimeType: mimeType, data: file.base64 } },
    ];
  } else {
    const buffer = Buffer.from(file.base64, "base64");
    let text = "";
    if (kind === "docx") {
      const result = await mammoth.extractRawText({ buffer: buffer });
      text = result.value || "";
    } else if (kind === "spreadsheet") {
      const wb = XLSX.read(buffer, { type: "buffer" });
      const parts: string[] = [];
      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        parts.push(XLSX.utils.sheet_to_csv(ws));
      }
      text = parts.join("\n\n");
    } else {
      text = buffer.toString("utf8");
    }
    if (!text.trim()) {
      throw new Error("We couldn't read any text from that file.");
    }
    contents = MENU_PROMPT + "\n\nMenu content:\n\n" + text.slice(0, 100000);
  }

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: contents,
    config: { responseMimeType: "application/json" },
  });

  const rawText =
    response.text ??
    response.candidates?.[0]?.content?.parts?.[0]?.text ??
    "";

  const cleaned = rawText
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/, "")
    .replace(/\s*```$/, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("The menu couldn't be read clearly. Try a clearer photo or file.");
  }

  const rawItems = Array.isArray(parsed)
    ? parsed
    : parsed &&
        typeof parsed === "object" &&
        Array.isArray((parsed as { items?: unknown[] }).items)
      ? (parsed as { items: unknown[] }).items
      : [];

  const items: ParsedMenuItem[] = [];
  for (const r of rawItems) {
    if (!r || typeof r !== "object") continue;
    const o = r as { name?: unknown; price?: unknown; category?: unknown };
    const name = typeof o.name === "string" ? o.name.trim() : "";
    if (!name) continue;
    let price: number | null = null;
    if (typeof o.price === "number" && isFinite(o.price)) {
      price = Math.round(o.price * 100) / 100;
    } else if (typeof o.price === "string") {
      const n = parseFloat(o.price.replace(/[^0-9.]/g, ""));
      if (!isNaN(n)) price = Math.round(n * 100) / 100;
    }
    if (price !== null && (price < 0 || price > 1000000)) price = null;
    const category =
      typeof o.category === "string" && o.category.trim()
        ? o.category.trim().slice(0, 60)
        : null;
    items.push({ name: name.slice(0, 120), price: price, category: category });
  }
  return items;
}