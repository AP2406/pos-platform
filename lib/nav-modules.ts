// CUST-1: the optional nav modules a role can be allowed to hide (by href).
// Core nav (POS, Settings, etc.) is never hide-able, so a role can't be locked
// out of the basics. Used by the layout (to filter) + the Roles card (toggles).
export const NAV_MODULES: { href: string; label: string }[] = [
  { href: "/app/reports", label: "Reports" },
  { href: "/app/tips", label: "Tips" },
  { href: "/app/clock", label: "Time clock" },
  { href: "/app/checklists", label: "Checklists" },
  { href: "/app/reservations", label: "Reservations" },
  { href: "/app/approvals", label: "Approvals" },
  { href: "/app/exceptions", label: "Exceptions" },
  { href: "/app/incidents", label: "Incidents" },
  { href: "/app/log", label: "Shift log" },
  { href: "/app/broadcasts", label: "Announcements" },
  { href: "/app/staff-records", label: "Staff records" },
  { href: "/app/accounting", label: "Accounting" },
  { href: "/app/labor", label: "Labor" },
  { href: "/app/schedule", label: "Schedule" },
  { href: "/app/attendance", label: "Attendance" },
  { href: "/app/insights", label: "Insights" },
  { href: "/app/pricing", label: "Happy hour" },
  { href: "/app/upsells", label: "Upsells" },
  { href: "/app/integrations", label: "Integrations" },
  { href: "/app/marketing", label: "Marketing" },
  { href: "/app/audit", label: "Activity log" },
];
