import { OrderStatusClient } from "./order-status-client";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-fA-F-]{36}$/;

// Track-my-order: a public page a pickup guest opens (from their confirmation
// screen) to watch their order go preparing -> ready -> completed. The opaque
// token is the only key; all reads go through the anon get_order_status RPC from
// the client, which polls. No auth, no PII, no money data.
export default async function OrderStatusPage({
  params,
}: {
  params: Promise<{ businessId: string; token: string }>;
}) {
  const { businessId, token } = await params;
  if (!UUID.test(businessId) || !UUID.test(token)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 text-zinc-500 text-lg p-8 text-center">
        This order link isn&apos;t valid.
      </div>
    );
  }
  return <OrderStatusClient businessId={businessId} token={token} />;
}
