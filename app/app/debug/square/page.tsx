import { SquareClient, SquareEnvironment } from "square";

async function getLocations() {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) {
    return { error: "SQUARE_ACCESS_TOKEN not set in .env.local" };
  }
  try {
    const client = new SquareClient({
      token,
      environment:
        process.env.SQUARE_ENVIRONMENT === "production"
          ? SquareEnvironment.Production
          : SquareEnvironment.Sandbox,
    });
    const res = await client.locations.list();
    return { locations: res.locations ?? [] };
  } catch (e: any) {
    return { error: e?.message ?? String(e) };
  }
}

export default async function SquareDebugPage() {
  const result = await getLocations();
  const configuredId = process.env.SQUARE_LOCATION_ID;
  const environment = process.env.SQUARE_ENVIRONMENT ?? "not set";

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Square Debug</h1>

      <div className="bg-slate-50 border rounded-lg p-4 space-y-1 text-sm">
        <div><strong>Environment:</strong> {environment}</div>
        <div><strong>SQUARE_ACCESS_TOKEN:</strong> {process.env.SQUARE_ACCESS_TOKEN ? "✅ Set" : "❌ Missing"}</div>
        <div><strong>SQUARE_LOCATION_ID in .env.local:</strong> <code>{configuredId ?? "not set"}</code></div>
      </div>

      {"error" in result && result.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
          <strong>Error fetching locations:</strong>
          <div className="mt-1 font-mono break-all">{result.error}</div>
        </div>
      )}

      {"locations" in result && result.locations && (
        <div className="bg-slate-50 border rounded-lg p-4">
          <h2 className="font-semibold mb-3">
            Your Square locations ({result.locations.length})
          </h2>
          {result.locations.length === 0 ? (
            <p className="text-sm text-slate-600">No locations found in this account.</p>
          ) : (
            <ul className="space-y-3">
              {result.locations.map((loc: any) => {
                const matches = loc.id === configuredId;
                return (
                  <li
                    key={loc.id}
                    className={`border-l-4 pl-3 py-1 ${matches ? "border-green-500 bg-green-50" : "border-slate-300"}`}
                  >
                    <div className="font-semibold">
                      {loc.name} {matches && "✅ Matches your .env.local"}
                    </div>
                    <div className="text-sm text-slate-600">
                      ID: <code className="bg-white px-1 rounded">{loc.id}</code>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Status: {loc.status} · Currency: {loc.currency ?? "—"} · Country: {loc.country ?? "—"}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <div className="text-xs text-slate-500">
        If your .env.local Location ID doesn't match any above, copy the correct ID
        from this list into <code>SQUARE_LOCATION_ID</code> in <code>.env.local</code>
        and restart the dev server.
      </div>
    </div>
  );
}