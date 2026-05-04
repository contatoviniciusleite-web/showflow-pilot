import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { ptBR } from "date-fns/locale";
import { format } from "date-fns";
import { Clock, MapPin } from "lucide-react";
import { STATUS_CLASS, STATUS_LABEL } from "@/lib/showStatus";
import { cn } from "@/lib/utils";
import { ShowDetailsModal } from "@/components/shows/ShowDetailsModal";
import { ExportMenu } from "@/components/ExportMenu";
import { exportCSV, exportPDF, type Column } from "@/lib/exporters";

interface FShow {
  id: string;
  artist_id: string;
  artist_nome?: string | null;
  artist_cor?: string | null;
  artist_cache_minimo?: number | null;
  data_show: string;
  horario: string | null;
  local: string | null;
  cidade: string | null;
  cache_total: number;
  status: string;
  vendedor: string | null;
  created_by: string | null;
  confirmado_por_nome?: string | null;
  confirmado_em?: string | null;
  contratante_nome?: string | null;
  prazo_comprovante_em?: string | null;
}

function ymd(d: Date) { return format(d, "yyyy-MM-dd"); }
function toKey(v?: string | null) { return v ? v.slice(0, 10) : ""; }

function effectiveStatus(s: FShow): string {
  if (s.status === "aguardando_pagamento" && s.prazo_comprovante_em && new Date(s.prazo_comprovante_em) < new Date()) {
    return "atrasado";
  }
  return s.status;
}

const EXTRA_LABEL: Record<string, string> = { atrasado: "ATRASADO" };
const EXTRA_CLASS: Record<string, string> = { atrasado: "bg-red-600 hover:bg-red-600 text-white" };

export function FinanceiroAgenda() {
  const [shows, setShows] = useState<FShow[]>([]);
  const [selected, setSelected] = useState<Date | undefined>(new Date());
  const [month, setMonth] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<FShow | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.functions.invoke("shows-admin", { body: { action: "list" } });
    setShows(((data?.shows ?? []) as FShow[]).filter((s) => s.status !== "cancelada"));
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("financeiro-agenda")
      .on("postgres_changes", { event: "*", schema: "public", table: "shows" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const byDay = useMemo(() => {
    const m = new Map<string, FShow[]>();
    for (const s of shows) {
      const k = toKey(s.data_show);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(s);
    }
    return m;
  }, [shows]);

  const occupied = useMemo(() => Array.from(byDay.keys()).map((d) => {
    const [y, m, dd] = d.split("-").map(Number);
    return new Date(y, m - 1, dd);
  }), [byDay]);

  const dayItems = selected ? (byDay.get(ymd(selected)) ?? []) : [];

  const monthShows = useMemo(() => {
    const ym = format(month, "yyyy-MM");
    return shows
      .filter((s) => s.data_show?.startsWith(ym))
      .sort((a, b) => a.data_show.localeCompare(b.data_show));
  }, [shows, month]);

  const exportMonth = (kind: "pdf" | "csv") => {
    const cols: Column[] = [
      { header: "Data", key: (r: FShow) => r.data_show.split("-").reverse().join("/") },
      { header: "Hora", key: (r: FShow) => (r.horario ? r.horario.slice(0, 5) : "—") },
      { header: "Artista", key: (r: FShow) => r.artist_nome ?? "—" },
      { header: "Local", key: (r: FShow) => [r.local, r.cidade].filter(Boolean).join(" · ") || "—" },
      { header: "Cachê", key: (r: FShow) => Number(r.cache_total ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), align: "right" },
      {
        header: "Status",
        key: (r: FShow) => {
          const eff = effectiveStatus(r);
          return (STATUS_LABEL as any)[eff] ?? EXTRA_LABEL[eff] ?? eff;
        },
      },
      { header: "Vendedor", key: (r: FShow) => r.vendedor ?? "—" },
    ];
    const total = monthShows.reduce((a, r) => a + Number(r.cache_total || 0), 0);
    const meta = {
      title: `Agenda — ${format(month, "MMMM 'de' yyyy", { locale: ptBR })}`,
      filename: `agenda-${format(month, "yyyy-MM")}`,
      summary: [
        { label: "Total de shows", value: String(monthShows.length) },
        { label: "Cachê total", value: total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) },
      ],
    };
    if (kind === "pdf") exportPDF(monthShows, cols, meta);
    else exportCSV(monthShows, cols, meta);
  };

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-[auto,1fr] gap-6">
        <Card className="p-4 shadow-soft">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={setSelected}
            month={month}
            onMonthChange={setMonth}
            locale={ptBR}
            weekStartsOn={1}
            modifiers={{ occupied }}
            modifiersClassNames={{ occupied: "relative font-semibold text-foreground after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1.5 after:h-1.5 after:rounded-full after:bg-primary" }}
            className={cn("p-3 pointer-events-auto")}
          />
          <div className="mt-3 space-y-1 text-xs text-muted-foreground">
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-yellow-500" /> Aguardando pagamento</div>
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-orange-500" /> Comprovante enviado</div>
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-600" /> Confirmado</div>
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-600" /> Atrasado</div>
          </div>
        </Card>

        <Card className="p-6 shadow-soft">
          <div className="mb-4">
            <h3 className="text-lg font-semibold">
              {selected ? format(selected, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR }) : "Selecione uma data"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {dayItems.length === 0 ? "Nenhum show neste dia." : `${dayItems.length} show(s) neste dia.`}
            </p>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : dayItems.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              Sem agenda neste dia.
            </div>
          ) : (
            <ul className="space-y-3">
              {dayItems.map((s) => {
                const eff = effectiveStatus(s);
                const cls = (STATUS_CLASS as any)[eff] ?? EXTRA_CLASS[eff] ?? "";
                const label = (STATUS_LABEL as any)[eff] ?? EXTRA_LABEL[eff] ?? eff;
                return (
                  <li key={s.id} className="border rounded-md p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: s.artist_cor ?? "hsl(var(--primary))" }} />
                        <p className="font-medium truncate">{s.artist_nome ?? "—"}</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1">
                        {s.horario && <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{s.horario.slice(0, 5)}</span>}
                        {s.local && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{s.local}{s.cidade ? ` · ${s.cidade}` : ""}</span>}
                        <span>{Number(s.cache_total ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={cls}>{label}</Badge>
                      <Button size="sm" variant="ghost" onClick={() => setActive(s)}>Abrir</Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <ShowDetailsModal show={active} open={!!active} onClose={() => setActive(null)} onChanged={load} />
    </>
  );
}
