import { NextResponse } from "next/server";
import { resolveApiContext } from "../_lib/context";
import { computeCartTax, type TaxItem } from "@/lib/services/tax-compute";
import { loadItemTaxMeta } from "@/lib/services/tax-meta";
import type { QuoteRequest, QuoteResponse, ApiError } from "@surge/api-contracts";
import type { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/v1/quote — Subtotal / Tax / Total for a cart. COMPUTE ONLY: reuses the
// canonical computeCartTax (the same math the web register/close/guest paths use)
// so the native register's totals match the eventual charge. No DB write, no
// charge — money-independent. Discounts/comps are not applied here (taxF = 1);
// the register's discount/comp path is stubbed until the write endpoints land.
export async function POST(req: Request) {
  const r = await resolveApiContext(req);
  if (!r.ok) return r.response;
  const { ctx } = r;

  let body: QuoteRequest;
  try {
    body = (await req.json()) as QuoteRequest;
  } catch {
    return NextResponse.json({ error: { code: "bad_request", message: "Invalid JSON body." } } satisfies ApiError, { status: 400 });
  }
  if (!Array.isArray(body?.items)) {
    return NextResponse.json({ error: { code: "bad_request", message: "items[] is required." } } satisfies ApiError, { status: 400 });
  }

  const items: TaxItem[] = body.items.map((i) => ({
    catalog_item_id: i.catalog_item_id ?? null,
    unit_price: Number(i.unit_price) || 0,
    quantity: Number(i.quantity) || 0,
  }));

  const subtotal = Math.round(items.reduce((s, i) => s + i.unit_price * i.quantity, 0) * 100) / 100;

  // Business default rate (normalized to a fraction, matching createOrder).
  const { data: biz } = await ctx.supabase
    .from("businesses")
    .select("default_tax_rate")
    .eq("id", ctx.businessId)
    .maybeSingle();
  let rate = Number((biz as { default_tax_rate?: number } | null)?.default_tax_rate) || 0;
  if (rate > 1) rate = rate / 100;

  const itemIds = Array.from(new Set(items.map((i) => i.catalog_item_id).filter((id): id is string => !!id)));
  const { itemTaxMeta, rateFracById, rateNameById } = await loadItemTaxMeta(
    ctx.supabase as unknown as Awaited<ReturnType<typeof createClient>>,
    ctx.businessId,
    itemIds
  );

  // No whole-order discount/comp in the quote → taxF = 1.
  const taxRes = computeCartTax(items, { defaultRateFrac: rate, itemTaxMeta, rateFracById, rateNameById }, 1);
  const tax = taxRes.tax;
  const total = Math.round((subtotal + tax) * 100) / 100;

  const body_out: QuoteResponse = { subtotal, tax, total, taxBreakdown: taxRes.taxBreakdown };
  return NextResponse.json(body_out);
}
