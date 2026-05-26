import { requireBusiness } from "@/lib/services/tenancy";
import Link from "next/link";
import { SignOutButton } from "./_components/sign-out";

type NavItem = { href: string; label: string };

const navByIndustry: Record<string, NavItem[]> = {
  transportation: [
    { href: "/app", label: "Dashboard" },
    { href: "/app/trips", label: "Trips" },
    { href: "/app/customers", label: "Customers" },
    { href: "/app/catalog", label: "Pricing" },
    { href: "/app/staff", label: "Staff" },
    { href: "/app/settings", label: "Settings" },
  ],
  restaurant: [
    { href: "/app", label: "Dashboard" },
    { href: "/app/pos", label: "POS" },
    { href: "/app/orders", label: "Orders" },
    { href: "/app/catalog", label: "Menu" },
    { href: "/app/customers", label: "Customers" },
    { href: "/app/staff", label: "Staff" },
    { href: "/app/settings", label: "Settings" },
  ],
  retail: [
    { href: "/app", label: "Dashboard" },
    { href: "/app/pos", label: "POS" },
    { href: "/app/orders", label: "Orders" },
    { href: "/app/catalog", label: "Products" },
    { href: "/app/customers", label: "Customers" },
    { href: "/app/staff", label: "Staff" },
    { href: "/app/settings", label: "Settings" },
  ],
  service: [
    { href: "/app", label: "Dashboard" },
    { href: "/app/pos", label: "Checkout" },
    { href: "/app/orders", label: "Visits" },
    { href: "/app/catalog", label: "Services" },
    { href: "/app/customers", label: "Customers" },
    { href: "/app/staff", label: "Staff" },
    { href: "/app/settings", label: "Settings" },
  ],
  mobile_seller: [
    { href: "/app", label: "Dashboard" },
    { href: "/app/pos", label: "Sell" },
    { href: "/app/orders", label: "Sales" },
    { href: "/app/catalog", label: "Items" },
    { href: "/app/settings", label: "Settings" },
  ],
};

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { business, role } = await requireBusiness();
  const nav = navByIndustry[business.industry] ?? navByIndustry.transportation;

  return (
    <div className="min-h-screen flex bg-slate-50">
      <aside className="w-60 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-4 border-b border-slate-200">
          <div className="text-xs uppercase tracking-wider text-slate-500">
            Business
          </div>
          <div className="font-semibold text-sm mt-0.5 truncate">
            {business.name}
          </div>
          <div className="text-xs text-slate-500 capitalize mt-0.5">
            {business.industry.replace("_", " ")} · {role}
          </div>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block px-3 py-2 text-sm rounded-md hover:bg-slate-100 transition"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-2 border-t border-slate-200">
          <SignOutButton />
        </div>
      </aside>
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  );
}