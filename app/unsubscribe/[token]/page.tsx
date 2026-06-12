import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// P2-34 public CASL unsubscribe. The token is the authorization; the RPC is
// SECURITY DEFINER and granted to anon, so no login is required.
export default async function UnsubscribePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const valid = /^[0-9a-fA-F-]{36}$/.test(token);

  let done = false;
  if (valid) {
    const supabase = await createClient();
    const { error } = await supabase.rpc("unsubscribe_marketing", { p_token: token });
    if (!error) done = true;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-sm w-full text-center space-y-3">
        <h1 className="text-xl font-semibold">{done ? "You're unsubscribed" : "Unsubscribe"}</h1>
        <p className="text-sm text-muted-foreground">
          {done
            ? "You won't receive any more marketing emails from us. You can opt back in any time by asking us in person."
            : "We couldn't process that unsubscribe link. It may be invalid or expired."}
        </p>
      </div>
    </div>
  );
}
