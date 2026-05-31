import { requireBusiness } from "@/lib/services/tenancy";
import { AppShell } from "./_components/app-shell";
import { AssistantWidget } from "./_components/assistant-widget";

type NavItem = { href: string; label: string };

const navByIndustry: Record<string, NavItem[]> = {
  transportation: [
    { href: "/app", label: "Dashboard" },
    { href: "/app/trips", label: "Trips" },
    { href: "/app/customers", label: "Customers" },
    { href: "/app/partners", label: "Partners" },
    { href: "/app/drivers", label: "Drivers" },
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
  let nav = navByIndustry[business.industry] ?? navByIndustry.transportation;

  if (business.drivers_enabled === false) {
    nav = nav.filter((item) => item.href !== "/app/drivers");
  }

  return (
    <>
      <AppShell
        businessName={business.name}
        industry={business.industry}
        role={role}
        nav={nav}
      >
        {children}
      </AppShell>
      <AssistantWidget />
    </>
  );
}
