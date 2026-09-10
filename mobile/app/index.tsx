import { Redirect } from "expo-router";
import { useSession } from "@/state/session";
import { SURFACE_ROUTE } from "@/lib/access";

// The gate (app/_layout) sends unauthenticated users to /sign-in; a full session
// lands on the role/device home surface.
export default function Index() {
  const s = useSession();
  if (!s.ready) return null;
  return <Redirect href={SURFACE_ROUTE[s.access?.home ?? "floor"]} />;
}
