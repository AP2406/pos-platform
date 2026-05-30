import { NextResponse } from "next/server";
import { requireBusiness } from "@/lib/services/tenancy";
import { squareFetch } from "@/lib/services/square";

export const runtime = "nodejs";

export async function GET() {
  let business;
  let role;
  try {
    const ctx = await requireBusiness();
    business = ctx.business;
    role = ctx.role;
  } catch {
    return NextResponse.json({ ok: false, error: "not authenticated" });
  }
  if (role !== "owner") {
    return NextResponse.json({ ok: false, error: "forbidden" });
  }

  try {
    const res = await squareFetch(business.id, "/v2/locations");
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ ok: false, square: data });
    }
    const locations = Array.isArray(data.locations)
      ? data.locations.map((l: any) => ({
          id: l.id,
          name: l.name,
          status: l.status,
        }))
      : [];
    return NextResponse.json({ ok: true, locations: locations });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message });
  }
}