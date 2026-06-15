import { liveSnapshot } from "./actions";
import { MobileManagerClient } from "./m-client";

export const dynamic = "force-dynamic";

export default async function MobileManagerPage() {
  const initial = await liveSnapshot();
  return <MobileManagerClient initial={initial} />;
}
