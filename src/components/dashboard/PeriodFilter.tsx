import { Period, PERIOD_LABEL } from "@/lib/dashboard";
import { cn } from "@/lib/utils";

const ORDER: Period[] = ["semana", "mes", "ano"];

export function PeriodFilter({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <div className="inline-flex rounded-md border bg-card p-1 shadow-sm">
      {ORDER.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className={cn(
            "px-3 py-1.5 text-sm rounded-sm transition-colors",
            value === p
              ? "bg-accent text-accent-foreground font-medium"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {PERIOD_LABEL[p]}
        </button>
      ))}
    </div>
  );
}
