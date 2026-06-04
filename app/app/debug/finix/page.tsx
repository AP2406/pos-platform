import { pingFinix, getFinixEnvironment, isFinixConfigured } from "@/lib/services/finix";

export const dynamic = "force-dynamic";

export default async function FinixDebugPage() {
  if (!isFinixConfigured()) {
    return (
      <div style={{ padding: 24, fontFamily: "monospace" }}>
        <h1>Finix debug \u2014 not configured</h1>
        <p>Missing one of: FINIX_API_USERNAME, FINIX_API_PASSWORD, FINIX_APPLICATION_ID</p>
      </div>
    );
  }

  const result = await pingFinix();
  const env = getFinixEnvironment();

  return (
    <div style={{ padding: 24, fontFamily: "monospace" }}>
      <h1>Finix debug</h1>
      <p>Environment: <strong>{env}</strong></p>
      <p>Status: <strong>{String(result.status)}</strong> {result.ok ? "OK" : "ERROR"}</p>
      <pre style={{ whiteSpace: "pre-wrap", background: "#f5f5f5", padding: 12, borderRadius: 8 }}>
        {JSON.stringify(result.data, null, 2)}
      </pre>
    </div>
  );
}