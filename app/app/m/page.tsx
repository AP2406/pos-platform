import { requireBusiness } from "@/lib/services/tenancy";
import { liveSnapshot } from "./actions";
import { MobileManagerClient } from "./m-client";

export const dynamic = "force-dynamic";

export default async function MobileManagerPage() {
  const { business } = await requireBusiness();
  const initial = await liveSnapshot();
  return <MobileManagerClient initial={initial} businessId={business.id} />;
}
