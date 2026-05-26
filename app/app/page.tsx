import { requireBusiness } from "@/lib/services/tenancy";

export default async function DashboardPage() {
  const { business } = await requireBusiness();

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="text-slate-500 mt-1">Welcome to {business.name}.</p>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Today's gross" value="$0.00" />
        <StatCard label="Trips today" value="0" />
        <StatCard label="Outstanding balance" value="$0.00" />
      </div>

      <div className="mt-12 p-8 bg-white border border-dashed border-slate-300 rounded-lg text-center">
        <h2 className="font-medium text-slate-900">Nothing here yet</h2>
        <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
          In the next build step we&apos;ll add trip bookings, customers, and
          pricing.
        </p>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5">
      <div className="text-xs uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className="text-2xl font-semibold mt-2">{value}</div>
    </div>
  );
}