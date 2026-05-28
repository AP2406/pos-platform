import { requireBusiness } from "@/lib/services/tenancy";
import { SignOutButton } from "./_components/sign-out";
import { SidebarNav } from "./_components/sidebar-nav";

type NavItem = { href: string; label: string };

const navByIndustry: Record<string, NavItem[]> = {
  transportation: [
    { href: "/app", label: "Dashboard" },
    { href: "/app/trips", label: "Trips" },
    { href: "/app/customers", label: "Customers" },
    { href: "/app/partners", label: "Partners" },
    { href: "/app/vehicles", label: "Vehicles" },
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
    <div className="min-h-screen flex bg-background">
      <aside className="w-60 bg-sidebar border-r border-sidebar-border flex flex-col shrink-0">
        {/* Logo + brand */}
        <div className="px-4 pt-5 pb-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2 mb-5">
          <div className="w-7 h-7 rounded-md bg-[oklch(0.62_0.215_254)] text-white flex items-center justify-center shrink-0 shadow-sm">
                <svg viewBox="0 0 24 24"
                fill="currentColor"
                className="w-4 h-4"
                aria-hidden="true"
              >
                <path d="M13 2L3 14h7v8l10-12h-7z" />
              </svg>
            </div>
            <span className="font-semibold text-sm tracking-tight">Surge</span>
          </div>

          {/* Business workspace context */}
          <div>
            <div className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground font-medium">
              Workspace
            </div>
            <div className="font-medium text-sm mt-1 truncate">
              {business.name}
            </div>
            <div className="text-xs text-muted-foreground capitalize mt-0.5">
              {business.industry.replace("_", " ")} · {role}
            </div>
          </div>
        </div>

        {/* Navigation (client component for active state) */}
        <SidebarNav items={nav} />

        {/* Sign out */}
        <div className="p-2 border-t border-sidebar-border">
          <SignOutButton />
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="p-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}