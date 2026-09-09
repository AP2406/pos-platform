"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { sendEmail, isEmailConfigured } from "@/lib/services/email";
import { revalidatePath } from "next/cache";
import { canAccess } from "@/lib/services/route-access";

// Same matrix the pages and the sidebar use, so a role that can see this
// screen can act on it — and the two can never drift apart.
function canManage(role: string): boolean {
  return canAccess(role, "edit_menu");
}

function num(v: unknown): number {
  return Math.round((Number(v) || 0) * 10000) / 10000;
}

export type POLineInput = {
  ingredient_id?: string | null;
  catalog_item_id?: string | null;
  description: string;
  unit: string;
  quantity: number;
  unit_cost: number;
};

/* --------------------------------- Vendors --------------------------------- */

export async function createVendor(input: {
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
}): Promise<{ ok: true; id: string } | { error: string }> {
  const name = (input.name || "").trim();
  if (name.length < 1) return { error: "Enter a vendor name." };
  const { business, role } = await requireBusiness();
  if (!canManage(role)) return { error: "Only an owner or manager can manage purchasing." };
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("vendors")
    .insert({
      business_id: business.id,
      name: name.slice(0, 120),
      email: input.email?.trim() ? input.email.trim().slice(0, 160) : null,
      phone: input.phone?.trim() ? input.phone.trim().slice(0, 40) : null,
      notes: input.notes?.trim() ? input.notes.trim().slice(0, 500) : null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("createVendor:", error);
    return { error: "Could not add the vendor. Please try again." };
  }
  revalidatePath("/app/purchasing");
  return { ok: true, id: data.id as string };
}

export async function updateVendor(
  id: string,
  fields: { name?: string; email?: string; phone?: string; notes?: string; is_active?: boolean }
): Promise<{ ok: true } | { error: string }> {
  if (!id) return { error: "Missing vendor." };
  const { business, role } = await requireBusiness();
  if (!canManage(role)) return { error: "Only an owner or manager can manage purchasing." };
  const supabase = await createClient();

  const patch: Record<string, unknown> = {};
  if (fields.name !== undefined) {
    const n = fields.name.trim();
    if (n.length < 1) return { error: "Enter a vendor name." };
    patch.name = n.slice(0, 120);
  }
  if (fields.email !== undefined) patch.email = fields.email.trim() ? fields.email.trim().slice(0, 160) : null;
  if (fields.phone !== undefined) patch.phone = fields.phone.trim() ? fields.phone.trim().slice(0, 40) : null;
  if (fields.notes !== undefined) patch.notes = fields.notes.trim() ? fields.notes.trim().slice(0, 500) : null;
  if (fields.is_active !== undefined) patch.is_active = !!fields.is_active;
  if (Object.keys(patch).length === 0) return { ok: true };

  const { error } = await supabase
    .from("vendors")
    .update(patch)
    .eq("id", id)
    .eq("business_id", business.id);
  if (error) {
    console.error("updateVendor:", error);
    return { error: "Could not save the vendor. Please try again." };
  }
  revalidatePath("/app/purchasing");
  return { ok: true };
}

export async function deleteVendor(id: string): Promise<{ ok: true } | { error: string }> {
  if (!id) return { error: "Missing vendor." };
  const { business, role } = await requireBusiness();
  if (!canManage(role)) return { error: "Only an owner or manager can manage purchasing." };
  const supabase = await createClient();
  const { error } = await supabase.from("vendors").delete().eq("id", id).eq("business_id", business.id);
  if (error) {
    console.error("deleteVendor:", error);
    return { error: "Could not remove the vendor. Please try again." };
  }
  revalidatePath("/app/purchasing");
  return { ok: true };
}

/* ------------------------------ Purchase orders ------------------------------ */

function normalizeLines(lines: POLineInput[]): {
  business_id?: string;
  ingredient_id: string | null;
  catalog_item_id: string | null;
  description: string;
  unit: string;
  quantity: number;
  unit_cost: number;
}[] {
  const out = [];
  for (const l of lines || []) {
    const qty = num(l.quantity);
    const desc = (l.description || "").trim();
    if (qty <= 0 && !desc) continue;
    out.push({
      ingredient_id: l.ingredient_id || null,
      catalog_item_id: l.catalog_item_id || null,
      description: desc.slice(0, 200) || "Item",
      unit: (l.unit || "unit").slice(0, 16),
      quantity: qty,
      unit_cost: Math.max(0, num(l.unit_cost)),
    });
  }
  return out;
}

export async function createPurchaseOrder(input: {
  vendor_id?: string | null;
  notes?: string;
  expected_at?: string | null;
  lines: POLineInput[];
}): Promise<{ ok: true; id: string } | { error: string }> {
  const { business, role } = await requireBusiness();
  if (!canManage(role)) return { error: "Only an owner or manager can manage purchasing." };
  const supabase = await createClient();

  const lines = normalizeLines(input.lines);
  if (lines.length === 0) return { error: "Add at least one line to the order." };

  const { data: poNum } = await supabase.rpc("next_po_number", { p_business_id: business.id });

  const { data: po, error: poErr } = await supabase
    .from("purchase_orders")
    .insert({
      business_id: business.id,
      vendor_id: input.vendor_id || null,
      po_number: Number(poNum) || 1,
      status: "draft",
      notes: input.notes?.trim() ? input.notes.trim().slice(0, 1000) : null,
      expected_at: input.expected_at || null,
    })
    .select("id")
    .single();
  if (poErr) {
    console.error("createPurchaseOrder:", poErr);
    return { error: "Could not create the order. Please try again." };
  }

  const rows = lines.map((l) => ({ ...l, business_id: business.id, po_id: po.id }));
  const { error: lineErr } = await supabase.from("po_lines").insert(rows);
  if (lineErr) {
    console.error("createPurchaseOrder lines:", lineErr);
    // Roll back the header so we don't leave an empty PO.
    await supabase.from("purchase_orders").delete().eq("id", po.id).eq("business_id", business.id);
    return { error: "Could not save the order lines. Please try again." };
  }

  revalidatePath("/app/purchasing");
  return { ok: true, id: po.id as string };
}

export async function updatePurchaseOrder(
  id: string,
  input: { vendor_id?: string | null; notes?: string; expected_at?: string | null; lines: POLineInput[] }
): Promise<{ ok: true } | { error: string }> {
  if (!id) return { error: "Missing order." };
  const { business, role } = await requireBusiness();
  if (!canManage(role)) return { error: "Only an owner or manager can manage purchasing." };
  const supabase = await createClient();

  const { data: po } = await supabase
    .from("purchase_orders")
    .select("id, status")
    .eq("id", id)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!po) return { error: "Order not found." };
  if (po.status !== "draft") return { error: "Only draft orders can be edited." };

  const lines = normalizeLines(input.lines);
  if (lines.length === 0) return { error: "Add at least one line to the order." };

  const { error: upErr } = await supabase
    .from("purchase_orders")
    .update({
      vendor_id: input.vendor_id || null,
      notes: input.notes?.trim() ? input.notes.trim().slice(0, 1000) : null,
      expected_at: input.expected_at || null,
    })
    .eq("id", id)
    .eq("business_id", business.id);
  if (upErr) {
    console.error("updatePurchaseOrder:", upErr);
    return { error: "Could not save the order. Please try again." };
  }

  // Replace lines wholesale (draft only).
  await supabase.from("po_lines").delete().eq("po_id", id).eq("business_id", business.id);
  const rows = lines.map((l) => ({ ...l, business_id: business.id, po_id: id }));
  const { error: lineErr } = await supabase.from("po_lines").insert(rows);
  if (lineErr) {
    console.error("updatePurchaseOrder lines:", lineErr);
    return { error: "Could not save the order lines. Please try again." };
  }

  revalidatePath("/app/purchasing");
  return { ok: true };
}

export async function deletePurchaseOrder(id: string): Promise<{ ok: true } | { error: string }> {
  if (!id) return { error: "Missing order." };
  const { business, role } = await requireBusiness();
  if (!canManage(role)) return { error: "Only an owner or manager can manage purchasing." };
  const supabase = await createClient();
  const { data: po } = await supabase
    .from("purchase_orders")
    .select("id, status")
    .eq("id", id)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!po) return { error: "Order not found." };
  if (po.status === "received") return { error: "A received order can't be deleted." };
  const { error } = await supabase.from("purchase_orders").delete().eq("id", id).eq("business_id", business.id);
  if (error) {
    console.error("deletePurchaseOrder:", error);
    return { error: "Could not delete the order. Please try again." };
  }
  revalidatePath("/app/purchasing");
  return { ok: true };
}

function poEmailHtml(opts: {
  businessName: string;
  poNumber: number;
  expected?: string | null;
  notes?: string | null;
  currency: string;
  lines: { description: string; unit: string; quantity: number; unit_cost: number }[];
}): string {
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: opts.currency }).format(n);
  const rows = opts.lines
    .map(
      (l) =>
        `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee">${escapeHtml(l.description)}</td>` +
        `<td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right">${l.quantity} ${escapeHtml(l.unit)}</td>` +
        `<td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right">${fmt(l.unit_cost)}</td>` +
        `<td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right">${fmt(l.unit_cost * l.quantity)}</td></tr>`
    )
    .join("");
  const total = opts.lines.reduce((s, l) => s + l.unit_cost * l.quantity, 0);
  return (
    `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111;max-width:640px">` +
    `<h2 style="margin:0 0 4px">Purchase order #${String(opts.poNumber).padStart(4, "0")}</h2>` +
    `<p style="color:#555;margin:0 0 16px">From ${escapeHtml(opts.businessName)}` +
    (opts.expected ? ` · needed by ${escapeHtml(opts.expected)}` : "") +
    `</p>` +
    `<table style="border-collapse:collapse;width:100%;font-size:14px">` +
    `<thead><tr>` +
    `<th style="text-align:left;padding:6px 10px;border-bottom:2px solid #111">Item</th>` +
    `<th style="text-align:right;padding:6px 10px;border-bottom:2px solid #111">Qty</th>` +
    `<th style="text-align:right;padding:6px 10px;border-bottom:2px solid #111">Unit</th>` +
    `<th style="text-align:right;padding:6px 10px;border-bottom:2px solid #111">Total</th>` +
    `</tr></thead><tbody>${rows}</tbody></table>` +
    `<p style="text-align:right;font-weight:700;margin:12px 0">Total: ${fmt(total)}</p>` +
    (opts.notes ? `<p style="color:#555;white-space:pre-wrap">${escapeHtml(opts.notes)}</p>` : "") +
    `</div>`
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );
}

// Receive a sent PO into stock. `receipts` maps po_line id -> received qty
// (omit a line to receive its full ordered quantity). Atomic via the RPC.
export async function receivePurchaseOrder(
  id: string,
  receipts: Record<string, number>
): Promise<{ ok: true } | { error: string }> {
  if (!id) return { error: "Missing order." };
  const { business, role } = await requireBusiness();
  if (!canManage(role)) return { error: "Only an owner or manager can manage purchasing." };
  const supabase = await createClient();

  const clean: Record<string, number> = {};
  for (const [k, v] of Object.entries(receipts || {})) {
    const n = Math.max(0, num(v));
    clean[k] = n;
  }

  const { error } = await supabase.rpc("receive_purchase_order", {
    p_po_id: id,
    p_business_id: business.id,
    p_receipts: clean,
  });

  if (error) {
    const m = error.message || "";
    if (m.includes("already_received")) return { error: "This order has already been received." };
    if (m.includes("po_cancelled")) return { error: "This order was cancelled." };
    if (m.includes("po_not_found")) return { error: "Order not found." };
    console.error("receivePurchaseOrder:", error);
    return { error: "Could not receive the order. Please try again." };
  }
  revalidatePath("/app/purchasing");
  return { ok: true };
}

// Mark a draft PO as sent; email the vendor if they have an address + email is configured.
export async function sendPurchaseOrder(
  id: string
): Promise<{ ok: true; emailed: boolean } | { error: string }> {
  if (!id) return { error: "Missing order." };
  const { business, role } = await requireBusiness();
  if (!canManage(role)) return { error: "Only an owner or manager can manage purchasing." };
  const supabase = await createClient();

  const { data: po } = await supabase
    .from("purchase_orders")
    .select("id, status, po_number, notes, expected_at, vendor:vendors(name, email)")
    .eq("id", id)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!po) return { error: "Order not found." };
  if (po.status !== "draft") return { error: "This order has already been sent." };

  const { data: lineRows } = await supabase
    .from("po_lines")
    .select("description, unit, quantity, unit_cost")
    .eq("po_id", id)
    .eq("business_id", business.id);

  const vendor = (po.vendor as { name?: string; email?: string } | null) ?? null;
  let emailed = false;
  if (vendor?.email && isEmailConfigured()) {
    const { data: bizRow } = await supabase
      .from("businesses")
      .select("name, currency")
      .eq("id", business.id)
      .maybeSingle();
    const html = poEmailHtml({
      businessName: (bizRow?.name as string) || business.name,
      poNumber: Number(po.po_number) || 0,
      expected: po.expected_at as string | null,
      notes: po.notes as string | null,
      currency: ((bizRow?.currency as string) || "USD").toUpperCase(),
      lines: (lineRows ?? []).map((l) => ({
        description: l.description as string,
        unit: l.unit as string,
        quantity: Number(l.quantity) || 0,
        unit_cost: Number(l.unit_cost) || 0,
      })),
    });
    const res = await sendEmail({
      to: vendor.email,
      subject: `Purchase order #${String(po.po_number).padStart(4, "0")} from ${business.name}`,
      html,
    });
    emailed = "ok" in res;
  }

  const { error } = await supabase
    .from("purchase_orders")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", id)
    .eq("business_id", business.id);
  if (error) {
    console.error("sendPurchaseOrder:", error);
    return { error: "Could not mark the order as sent. Please try again." };
  }

  revalidatePath("/app/purchasing");
  return { ok: true, emailed };
}
