import { Redirect } from "expo-router";

// The gate (app/_layout) sends unauthenticated users to /sign-in; a full session
// lands on the floor.
export default function Index() {
  return <Redirect href="/floor" />;
}
