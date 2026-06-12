"use server";

import { createClient } from "@/lib/supabase/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { revalidatePath } from "next/cache";

// P2-32 gift cards. Balance is real money in integer cents internally; the UI
// works in dollars. Every balance change goes through apply_gift_card_delta so
// the ledger and balance stay reconciled.
export type GiftCardInfo = { id: string; code: string; balance: number; active: boolean };

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous 0/O/1/I

function generateCode(): string {
  let out = "";
  for (let i = 0; i < 12; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    if (i === 3 || i === 7) out += "-";
  }
  return out;
}

function normalizeCode(code: string): string {
  return (code || "").toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 24);
}

function dollarsToCents(amount: number): number {
  return Math.round((Number(amount) || 0) * 100);
}

export async function issueGiftCard(
  amount: number,
  code?: string
): Promise<{ ok: true; card: GiftCardInfo } | { error: string }> {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") {
    return { error: "Only an owner or manager can issue gift cards." };
  }
  const cents = dollarsToCents(amount);
  if (cents <= 0) return { error: "Enter a gift card amount." };
  if (cents > 100000000) return { error: "That amount is too large." };

  const supabase = await createClient();
  const wanted = code ? normalizeCode(code) : "";
  const finalCode = wanted || generateCode();

  // Create the card empty, then load the value through the ledger so the issue
  // is recorded as a ledger row.
  const { data: created, error: insErr } = await supabase
    .from("gift_cards")
    .insert({ business_id: business.id, code: finalCode, balance_cents: 0 })
    .select("id")
    .single();
  if (insErr || !created) {
    if (insErr && (insErr as { code?: string }).code === "23505") {
      return { error: "That gift card code is already in use." };
    }
    console.error("issueGiftCard insert:", insErr);
    return { error: "Could not create the gift card." };
  }

  const cardId = created.id as string;
  const { data: bal, error: rpcErr } = await supabase.rpc("apply_gift_card_delta", {
    p_business_id: business.id,
    p_gift_card_id: cardId,
    p_delta_cents: cents,
    p_kind: "issue",
    p_order_id: null,
  });
  if (rpcErr) {
    console.error("issueGiftCard delta:", rpcErr);
    return { error: "Could not load the gift card." };
  }

  revalidatePath("/app/settings");
  return { ok: true, card: { id: cardId, code: finalCode, balance: (Number(bal) || 0) / 100, active: true } };
}

export async function reloadGiftCard(
  code: string,
  amount: number
): Promise<{ ok: true; card: GiftCardInfo } | { error: string }> {
  const { business, role } = await requireBusiness();
  if (role !== "owner" && role !== "manager") {
    return { error: "Only an owner or manager can reload gift cards." };
  }
  const cents = dollarsToCents(amount);
  if (cents <= 0) return { error: "Enter an amount to add." };

  const supabase = await createClient();
  const card = await findCard(supabase, business.id, code);
  if (!card) return { error: "Gift card not found." };

  const { data: bal, error: rpcErr } = await supabase.rpc("apply_gift_card_delta", {
    p_business_id: business.id,
    p_gift_card_id: card.id,
    p_delta_cents: cents,
    p_kind: "reload",
    p_order_id: null,
  });
  if (rpcErr) {
    console.error("reloadGiftCard:", rpcErr);
    return { error: "Could not reload the gift card." };
  }
  revalidatePath("/app/settings");
  return { ok: true, card: { id: card.id, code: card.code, balance: (Number(bal) || 0) / 100, active: true } };
}

export async function lookupGiftCard(code: string): Promise<GiftCardInfo | null> {
  const { business } = await requireBusiness();
  const supabase = await createClient();
  const card = await findCard(supabase, business.id, code);
  if (!card) return null;
  return { id: card.id, code: card.code, balance: card.balance_cents / 100, active: card.is_active };
}

async function findCard(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
  code: string
): Promise<{ id: string; code: string; balance_cents: number; is_active: boolean } | null> {
  const norm = normalizeCode(code);
  if (!norm) return null;
  const { data } = await supabase
    .from("gift_cards")
    .select("id, code, balance_cents, is_active")
    .eq("business_id", businessId)
    .eq("code", norm)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id as string,
    code: data.code as string,
    balance_cents: data.balance_cents as number,
    is_active: data.is_active as boolean,
  };
}
