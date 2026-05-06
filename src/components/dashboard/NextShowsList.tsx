import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { fmtDate, fmtBRL } from "@/lib/dashboard";
import { STATUS_CLASS, STATUS_LABEL } from "@/lib/showStatus";

export interface QuickShow {
  id: string;
  artist_nome?: string | null;
  data_show: string;
  local?: string | null;
  cidade?: string | null;
  cache_total?: number | null;
  status: string;
}

export function NextShowsList({
  shows,
  showCache = false,
  emptyMessage = "Nenhum show futuro.",
}: {
  shows: QuickShow[];
  showCache?: boolean;
  emptyMessage?: string;
}) {
  return (
    <Card className="p-5 shadow-soft">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Próximos shows</h2>
        <Link to="/shows" className="text-xs text-accent hover:underline">Ver todos</Link>
      </div>
      {shows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <ul className="divide-y">
          {shows.slice(0, 5).map((s) => (
            <li key={s.id} className="py-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{s.artist_nome ?? "—"}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {fmtDate(s.data_show)}
                  {s.cidade ? ` · ${s.cidade}` : ""}
                  {showCache && s.cache_total ? ` · ${fmtBRL(Number(s.cache_total))}` : ""}
                </p>
              </div>
              <Badge className={STATUS_CLASS[s.status as keyof typeof STATUS_CLASS] ?? ""}>
                {STATUS_LABEL[s.status as keyof typeof STATUS_LABEL] ?? s.status}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
