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
  new_lead:
    "bg-violet-100 text-violet-700 ring-1 ring-inset ring-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-500/30",
  confirmed:
    "bg-sky-100 text-sky-700 ring-1 ring-inset ring-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/30",
  decision_making:
    "bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30",
  completed:
    "bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30",
  lost:
    "bg-rose-100 text-rose-700 ring-1 ring-inset ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30",
  booked:
    "bg-secondary text-secondary-foreground ring-1 ring-inset ring-border",
  in_progress:
    "bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30",
  cancelled:
    "bg-rose-100 text-rose-700 ring-1 ring-inset ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30",
  no_show:
    "bg-rose-100 text-rose-700 ring-1 ring-inset ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30",
};

export function StatusBadge({ status }: { status: string }) {
  const fallback =
    "bg-secondary text-secondary-foreground ring-1 ring-inset ring-border";
  const style = statusStyles[status] ?? fallback;
  return (
    <span
      className={
        "inline-flex items-center text-[10px] uppercase tracking-[0.08em] px-2 py-0.5 rounded-md font-semibold " +
        style
      }
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
      className={
        "text-[10px] uppercase tracking-[0.08em] text-muted-foreground font-semibold mb-3 " +
        className
      }
    >
      {children}
    </h2>
  );
}