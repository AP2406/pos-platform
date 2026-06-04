"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_BUSINESS_COOKIE } from "@/lib/services/tenancy";

export async function switchBusiness(businessId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Only allow switching to a business the user actually belongs to.
  const { data, error } = await supabase
    .from("business_members")
    .select("business_id")
    .eq("user_id", user.id)
    .eq("business_id", businessId)
    .maybeSingle();

  if (error || !data) {
    redirect("/app");
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_BUSINESS_COOKIE, businessId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });

  redirect("/app");
}