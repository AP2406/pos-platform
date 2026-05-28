export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && (
          <p className="text-muted-foreground mt-1 text-sm">{subtitle}</p>
        )}
      </div>
      {action && (
        <div className="shrink-0 flex items-center gap-2">{action}</div>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  message,
  action,
}: {
  title?: string;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-dashed border-border rounded-lg p-12 text-center">
      {title && <h2 className="font-medium text-foreground">{title}</h2>}
      <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
        {message}
      </p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

const statusStyles: Record<string, string> = {
  booked: "bg-secondary text-secondary-foreground",
  confirmed: "bg-blue-50 text-blue-700",
  in_progress: "bg-amber-50 text-amber-700",
  completed: "bg-green-50 text-green-700",
  cancelled: "bg-red-50 text-red-700",
  no_show: "bg-red-50 text-red-700",
};

export function StatusBadge({ status }: { status: string }) {
  const style =
    statusStyles[status] ?? "bg-secondary text-secondary-foreground";
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-md capitalize font-medium ${style}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

export function SectionHeader({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={`text-[10px] uppercase tracking-[0.08em] text-muted-foreground font-semibold mb-3 ${className}`}
    >
      {children}
    </h2>
  );
}