import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

export type PendingTone = "red" | "amber" | "blue";

export interface PendingItem {
  id: string;
  tone: PendingTone;
  label: string;
  href: string;
}

const DOT: Record<PendingTone, string> = {
  red: "bg-red-500",
  amber: "bg-yellow-500",
  blue: "bg-blue-500",
};

export function PendingActions({ items }: { items: PendingItem[] }) {
  const top = items.slice(0, 5);
  return (
    <Card className="p-5 shadow-soft">
      <h2 className="text-lg font-semibold mb-3">Ações pendentes</h2>
      {top.length === 0 ? (
        <p className="text-sm text-green-600 text-center py-4">
          ✅ Tudo em dia! Nenhuma ação pendente.
        </p>
      ) : (
        <ul className="divide-y">
          {top.map((it) => (
            <li key={it.id} className="py-2.5 flex items-center gap-3">
              <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${DOT[it.tone]}`} />
              <span className="text-sm flex-1 min-w-0">{it.label}</span>
              <Link
                to={it.href}
                className="text-xs text-accent hover:underline flex items-center gap-1 shrink-0"
              >
                Ver <ArrowRight className="h-3 w-3" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
