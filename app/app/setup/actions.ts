"use server";

import { GoogleGenAI } from "@google/genai";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { validateConfig } from "@/lib/modules/config";
import { Preset } from "@/lib/modules/presets";

// Only modules that have real, working pages today. The generator may not
// choose anything outside this set, even though more module keys exist.
const GENERATABLE_MODULES = [
  "dashboard",
  "jobs",
  "customers",
  "calendar",
  "profit",
  "settings",
];

const GEN_PROMPT = [
  "You configure a business management app for a new business.",
  "You do NOT write code. You only choose words and options from fixed lists.",
  "",
  "Read the business description and return ONLY a JSON object in this shape:",
  "{",
  '  "vocab": {',
  '    "job_singular": the main thing this business books or does, singular (e.g. Appointment, Job, Repair, Session),',
  '    "job_plural": plural of the above,',
  '    "resource_singular": the person who performs the work (e.g. Stylist, Technician, Cleaner). If none, use Staff,',
  '    "resource_plural": plural of the above,',
  '    "asset_singular": a physical thing used for the work (e.g. Chair, Bay, Room). If none, use Resource,',
  '    "asset_plural": plural of the above',
  "  },",
  '  "modules": an array. Pick ONLY from: dashboard, jobs, customers, calendar, profit, settings. Always include dashboard, jobs, customers, settings.,',
  '  "labels": optional object overriding a module label, e.g. {"jobs": "Appointments"}. Keys must be from the modules list.,',
  '  "fields": optional array of the 2 to 5 most useful extra details captured on each booking. Each item:',
  "  {",
  '    "key": short slug, lowercase letters and underscores only (e.g. service_type),',
  '    "label": human label (e.g. Service type),',
  '    "type": one of text, number, textarea, date, datetime, select,',
  '    "section": always exactly the word Details,',
  '    "required": true or false (optional),',
  '    "options": array of strings, ONLY for type select',
  "  }",
  "}",
  "",
  "Rules:",
  "- Use the business's own everyday words for vocab.",
  "- Label the jobs module with the plural job word (e.g. Appointments).",
  "- Only include fields that make sense for THIS business. No generic filler.",
  "- Every field section must be exactly the word Details.",
  "- Never include any module, field, or type not listed above.",
  "- Return ONLY the JSON object. No markdown, no backticks, no commentary.",
  "",
  "Business description:",
  "{DESCRIPTION}",
].join("\n");

function sanitizeForGenerator(raw: unknown): Preset | null {
  const config = validateConfig(raw);
  if (!config) return null;

  config.modules = config.modules.filter((m) => GENERATABLE_MODULES.includes(m));
  if (!config.modules.includes("dashboard")) config.modules.unshift("dashboard");
  if (!config.modules.includes("settings")) config.modules.push("settings");

  if (config.fields) {
    config.fields = config.fields.map((f) => ({ ...f, section: "Details" }));
  }

  return config;
}

export async function generateBusinessConfig(
  description: string
): Promise<{ ok: true; config: Preset } | { error: string }> {
  await requireBusiness();

  const desc = (description ?? "").trim();
  if (desc.length < 10) {
    return { error: "Tell me a bit more about the business (at least a sentence)." };
  }
  if (!process.env.GEMINI_API_KEY) {
    return { error: "AI is not configured on the server." };
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const prompt = GEN_PROMPT.replace("{DESCRIPTION}", desc);

  let rawText = "";
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite",
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });
    rawText =
      response.text ??
      response.candidates?.[0]?.content?.parts?.[0]?.text ??
      "";
  } catch (e) {
    console.error("generateBusinessConfig gemini:", e);
    return { error: "Could not reach the AI. Please try again in a moment." };
  }

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
    return {
      error: "The AI returned something unexpected. Try rephrasing your description.",
    };
  }

  const config = sanitizeForGenerator(parsed);
  if (!config) {
    return {
      error: "Could not build a valid setup from that. Try adding a bit more detail.",
    };
  }

  return { ok: true, config };
}

export async function saveBusinessConfig(
  config: unknown
): Promise<{ ok: true } | { error: string }> {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") {
    return { error: "Only owners or managers can change the setup." };
  }

  const validated = sanitizeForGenerator(config);
  if (!validated) {
    return { error: "That setup is not valid. Generate it again." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("businesses")
    .update({ config: validated })
    .eq("id", business.id);

  if (error) {
    console.error("saveBusinessConfig:", error);
    return { error: "Could not save the setup. Please try again." };
  }

  revalidatePath("/app");
  return { ok: true };
}