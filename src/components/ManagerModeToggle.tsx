import { useManagerMode, ManagerMode } from "@/contexts/ManagerModeContext";
import { cn } from "@/lib/utils";

const OPTIONS: { value: ManagerMode; label: string }[] = [
  { value: "gerencia", label: "👑 Gerência" },
  { value: "vendedor", label: "🤝 Vendedor" },
];

export function ManagerModeToggle({ compact = false }: { compact?: boolean }) {
  const { mode, setMode, isManager } = useManagerMode();
  if (!isManager) return null;

  return (
    <div
      className={cn(
        "inline-flex rounded-full border bg-card p-1 shadow-sm",
        compact ? "text-xs" : "text-sm",
      )}
      role="group"
      aria-label="Alternar modo de trabalho"
    >
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => setMode(opt.value)}
          aria-pressed={mode === opt.value}
          className={cn(
            "rounded-full transition-colors",
            compact ? "px-2.5 py-1" : "px-3 py-1.5",
            mode === opt.value
              ? "bg-accent text-accent-foreground font-medium shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
