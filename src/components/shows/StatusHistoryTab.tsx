import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { STATUS_CLASS, STATUS_LABEL } from "@/lib/showStatus";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, History } from "lucide-react";

interface Entry {
  id: string;
  status_anterior: string | null;
  status_novo: string;
  motivo: string | null;
  changed_by_nome: string | null;
  changed_at: string;
}

function StatusBadge({ s }: { s: string | null }) {
  if (!s) return <Badge variant="outline">—</Badge>;
  const cls = (STATUS_CLASS as any)[s] ?? "bg-muted text-muted-foreground";
  const label = (STATUS_LABEL as any)[s] ?? s;
  return <Badge className={cls}>{label}</Badge>;
}

export function StatusHistoryTab({ showId }: { showId: string }) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Entry[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("show_status_history")
        .select("id,status_anterior,status_novo,motivo,changed_by_nome,changed_at")
        .eq("show_id", showId)
        .order("changed_at", { ascending: false });
      if (!alive) return;
      setItems((data as any) ?? []);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [showId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando histórico...
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4 flex items-center gap-2">
        <History className="h-4 w-4" /> Sem histórico de status.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        Histórico de mudanças de status
      </p>
      <ol className="relative border-l border-border pl-4 space-y-3">
        {items.map((e) => (
          <li key={e.id} className="relative">
            <span className="absolute -left-[21px] top-2 h-2.5 w-2.5 rounded-full bg-primary" />
            <div className="rounded-md border p-3 space-y-1.5 text-sm">
              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge s={e.status_anterior} />
                <span className="text-muted-foreground">→</span>
                <StatusBadge s={e.status_novo} />
              </div>
              <div className="text-xs text-muted-foreground">
                {format(new Date(e.changed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                {e.changed_by_nome && <> · por <strong className="text-foreground">{e.changed_by_nome}</strong></>}
              </div>
              {e.motivo && (
                <p className="text-xs"><strong>Motivo:</strong> {e.motivo}</p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
