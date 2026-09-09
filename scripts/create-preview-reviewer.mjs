// One-off: create a "reviewer" login for sharing the admin dashboard with an
// outside reviewer (e.g. an AI review tool) WITHOUT sharing your own password or
// disabling auth.
//
//   node --env-file=.env.local scripts/create-preview-reviewer.mjs "Aathy Bistro"
//   node --env-file=.env.local scripts/create-preview-reviewer.mjs <business-uuid>
//
// • Creates auth user reviewer+<random>@surgetechpos.com (random 32-char password)
// • Adds it to the given business as `manager` (not owner) — RLS scopes the
//   reviewer to that one business, nothing else in the project.
// • Appends PREVIEW_LOGIN_TOKEN / PREVIEW_REVIEWER_EMAIL / PREVIEW_REVIEWER_PASSWORD
//   to .env.local — the middleware signs that account in when a request carries
//   ?key=<PREVIEW_LOGIN_TOKEN>. Delete those three lines (or the auth user) to
//   revoke the link.
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { appendFileSync, readFileSync } from "node:fs";

const target = process.argv[2];
if (!target) {
  console.error('usage: node --env-file=.env.local scripts/create-preview-reviewer.mjs "<business name or id>"');
  process.exit(1);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing — run with --env-file=.env.local");
  process.exit(1);
}
if (readFileSync(".env.local", "utf8").includes("PREVIEW_LOGIN_TOKEN=")) {
  console.error("PREVIEW_LOGIN_TOKEN already present in .env.local — remove the PREVIEW_* lines first to rotate.");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

// Business by id or (case-insensitive) name. Plain table reads — no auth admin
// listing, which some projects 500 on.
const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(target);
const q = admin.from("businesses").select("id, name, industry, config");
const { data: matches, error: bErr } = isUuid ? await q.eq("id", target) : await q.ilike("name", target);
if (bErr) throw bErr;
if (!matches?.length) {
  console.error("No business matches", target);
  process.exit(1);
}
if (matches.length > 1) {
  console.error("Several businesses match — use the id:", matches.map((b) => `${b.name} (${b.id})`).join(", "));
  process.exit(1);
}
const biz = matches[0];

// Reviewer account (manager role so it can see the admin surface but not owner-only settings).
const suffix = randomBytes(4).toString("hex");
const reviewerEmail = `reviewer+${suffix}@surgetechpos.com`;
const reviewerPassword = randomBytes(24).toString("base64url");
const { data: created, error: cErr } = await admin.auth.admin.createUser({
  email: reviewerEmail,
  password: reviewerPassword,
  email_confirm: true,
  user_metadata: { full_name: "Design reviewer", preview_reviewer: true },
});
if (cErr) throw cErr;
const { error: jErr } = await admin.from("business_members").insert({ business_id: biz.id, user_id: created.user.id, role: "manager" });
if (jErr) throw jErr;

const token = randomBytes(24).toString("base64url");
appendFileSync(
  ".env.local",
  `\n# Reviewer login link (see lib/supabase/middleware.ts). Delete these 3 lines to revoke.\nPREVIEW_LOGIN_TOKEN=${token}\nPREVIEW_REVIEWER_EMAIL=${reviewerEmail}\nPREVIEW_REVIEWER_PASSWORD=${reviewerPassword}\n`
);
console.log(JSON.stringify({ business: biz.name, businessId: biz.id, mode: biz.config?.mode ?? null, reviewerEmail, reviewerUserId: created.user.id, token }, null, 2));
