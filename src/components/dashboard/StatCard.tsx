import { Card } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

export type StatTone = "amber" | "green" | "red" | "orange" | "blue" | "default";

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  tone = "default",
  highlight = false,
  onClick,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  hint?: string;
  tone?: StatTone;
  highlight?: boolean;
  onClick?: () => void;
}) {
  const toneCls =
    tone === "amber" ? "bg-amber-500/10 text-amber-600" :
    tone === "green" ? "bg-green-500/10 text-green-600" :
    tone === "red" ? "bg-destructive/10 text-destructive" :
    tone === "orange" ? "bg-orange-500/10 text-orange-600" :
    tone === "blue" ? "bg-blue-500/10 text-blue-600" :
    "bg-accent/10 text-accent";

  const cardCls = highlight && tone === "red"
    ? "p-5 shadow-soft border-destructive/40 bg-destructive/5"
    : "p-5 shadow-soft";

  const interactiveCls = onClick
    ? "cursor-pointer transition hover:shadow-md hover:-translate-y-0.5 hover:border-accent/40 focus:outline-none focus:ring-2 focus:ring-accent/40"
    : "";

  return (
    <Card
      className={`${cardCls} ${interactiveCls}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold mt-2 break-words">{value}</p>
          {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
        </div>
        <div className={`h-9 w-9 shrink-0 rounded-md flex items-center justify-center ${toneCls}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </Card>
  );
}
