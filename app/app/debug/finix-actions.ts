"use server";

import { requireBusiness } from "@/lib/services/tenancy";
import { finix, getFinixConfig, isFinixConfigured } from "@/lib/services/finix";

type FinixIdentity = {
  id: string;
  entity?: { business_name?: string; first_name?: string; last_name?: string };
  created_at: string;
};

type FinixListResponse<T> = {
  _embedded?: Record<string, T[]>;
  page?: { offset: number; limit: number; count?: number };
};

export async function pingFinix(): Promise<
  | { ok: true; summary: string; sample: unknown }
  | { error: string; details?: unknown }
> {
  await requireBusiness();

  if (!isFinixConfigured()) {
    return {
      error:
        "Finix env vars missing. Need FINIX_USERNAME, FINIX_PASSWORD, FINIX_APPLICATION_ID in .env.local.",
    };
  }

  const result = await finix.get<FinixListResponse<FinixIdentity>>(
    "/identities?limit=3"
  );

  if ("error" in result) {
    return { error: result.error, details: result.details };
  }

  const config = getFinixConfig();
  const identities = result.data._embedded?.identities ?? [];

  return {
    ok: true,
    summary: `Connected to Finix ${config.environment}. Application: ${config.applicationId.slice(0, 12)}… · Found ${identities.length} identities (showing first ${Math.min(3, identities.length)}).`,
    sample: identities.map((i) => ({
      id: i.id,
      name:
        i.entity?.business_name ??
        [i.entity?.first_name, i.entity?.last_name].filter(Boolean).join(" ") ??
        "—",
      created_at: i.created_at,
    })),
  };
}