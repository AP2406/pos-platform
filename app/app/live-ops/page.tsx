import { notFound } from "next/navigation";
import { requireBusiness } from "@/lib/services/tenancy";
import { canAccess } from "@/lib/services/route-access";
import { createClient } from "@/lib/supabase/server";
import { getTodayBoundsUTC } from "@/lib/utils/dates";
import { LiveOpsClient, type FloorTicket, type FeedOrder, type KdsTicket } from "./live-ops-client";

export const dynamic = "force-dynamic";

// Owner "Live Operations" (§2b of the Native iOS POS blueprint): a read-only,
// real-time mirror of the floor + order feed + KDS + live sales, watchable from
// anywhere in the web admin app. Owners OBSERVE — they don't ring sales here.
// Pure reads; no money/permission path touched. The client subscribes to
// Supabase Realtime and refreshes; this server load just seeds it.
export default async function LiveOpsPage() {
  const { business, role } = await requireBusiness();
  if (!canAccess(role, "void")) notFound();

  const supabase = await createClient();
  const tz = business.timezone || "America/Toronto";
  const { start: todayStart, end: todayEnd } = getTodayBoundsUTC(tz);

  const [openTicketsRes, kdsRes, ordersRes] = await Promise.all([
    supabase
      .from("open_tickets")
      .select("id, label, ticket_type, guest_count, channel, opened_at, check_dropped_at")
      .eq("business_id", business.id)
      .order("opened_at", { ascending: true }),
    supabase
      .from("kitchen_tickets")
      .select("id, label, items, fired_at, fulfilled_at")
      .eq("business_id", business.id)
      .is("fulfilled_at", null)
      .order("fired_at", { ascending: true }),
    supabase
      .from("orders")
      .select("id, sale_number, total, payment_method, status, created_at, is_training")
      .eq("business_id", business.id)
      .neq("status", "voided")
      .gte("created_at", todayStart.toISOString())
      .lt("created_at", todayEnd.toISOString())
      .order("created_at", { ascending: false }),
  ]);

  const floor: FloorTicket[] = (openTicketsRes.data ?? []).map((t) => ({
    id: t.id as string,
    label: (t.label as string) || "Ticket",
    ticketType: (t.ticket_type as string | null) ?? null,
    guests: Number(t.guest_count) || 0,
    channel: (t.channel as string | null) ?? null,
    openedAt: t.opened_at as string,
    checkDropped: t.check_dropped_at != null,
  }));

  const kds: KdsTicket[] = (kdsRes.data ?? []).map((k) => {
    const items = Array.isArray(k.items) ? (k.items as Array<{ name?: string; quantity?: number }>) : [];
    return {
      id: k.id as string,
      label: (k.label as string | null) ?? null,
      firedAt: k.fired_at as string,
      items: items.map((it) => ({ name: String(it.name ?? "Item"), quantity: Number(it.quantity) || 1 })),
    };
  });

  const allToday = (ordersRes.data ?? []).filter((o) => !o.is_training);
  const feed: FeedOrder[] = allToday.slice(0, 15).map((o) => ({
    id: o.id as string,
    saleNumber: o.sale_number != null ? Number(o.sale_number) : null,
    total: Number(o.total) || 0,
    method: (o.payment_method as string | null) ?? "cash",
    createdAt: o.created_at as string,
  }));
  const salesTotal = Math.round(allToday.reduce((s, o) => s + (Number(o.total) || 0), 0) * 100) / 100;
  const salesCount = allToday.length;

  return (
    <LiveOpsClient
      businessId={business.id}
      currency={business.currency || "CAD"}
      timezone={tz}
      dayStartIso={todayStart.toISOString()}
      initialFloor={floor}
      initialKds={kds}
      initialFeed={feed}
      initialSalesTotal={salesTotal}
      initialSalesCount={salesCount}
    />
  );
}
