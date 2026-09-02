export function StatCard({
  label, value, sub, tone = "default",
}: { label: string; value: string; sub?: string; tone?: "default" | "green" | "amber" | "red" | "blue" }) {
  const toneClass = {
    default: "text-forest",
    green: "text-status-green",
    amber: "text-status-amber",
    red: "text-status-red",
    blue: "text-status-blue",
  }[tone];
  return (
    <div className="card p-5">
      <div className="text-xs font-medium text-charcoal/55 tracking-wide uppercase">{label}</div>
      <div className={`text-3xl font-semibold mt-2 ${toneClass}`}>{value}</div>
      {sub && <div className="text-xs text-charcoal/45 mt-1">{sub}</div>}
    </div>
  );
}

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-semibold text-forest">{title}</h1>
        {description && <p className="text-sm text-charcoal/55 mt-1">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function money(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}
export function moneyPrecise(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}
