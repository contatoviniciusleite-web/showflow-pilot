import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, MapPin } from "lucide-react";
import { ptBR } from "date-fns/locale";
import { format } from "date-fns";
import { STATUS_CLASS, STATUS_LABEL } from "@/lib/showStatus";
import { ExportMenu } from "@/components/ExportMenu";
import { exportCSV, exportPDF, type Column } from "@/lib/exporters";
import { MonthCalendar, STATUS_COLORS, type AgendaEvent } from "@/components/agenda/MonthCalendar";

const ShowDetailsModal = lazy(() => import("@/components/shows/ShowDetailsModal").then(m => ({ default: m.ShowDetailsModal })));

interface FShow {
  id: string;
  artist_id: string;
  artist_nome?: string | null;
  artist_cor?: string | null;
  data_show: string;
  horario: string | null;
  local: string | null;
  cidade: string | null;
  cache_total: number;
  status: string;
  vendedor: string | null;
  created_by: string | null;
  prazo_comprovante_em?: string | null;
}

function effectiveStatus(s: FShow): string {
  if (s.status === "aguardando_pagamento" && s.prazo_comprovante_em && new Date(s.prazo_comprovante_em) < new Date()) {
    return "atrasado";
  }
  return s.status;
}

const EXTRA_LABEL: Record<string, string> = { atrasado: "ATRASADO" };
const EXTRA_CLASS: Record<string, string> = { atrasado: "bg-red-700 hover:bg-red-700 text-white" };

export function FinanceiroAgenda() {
  const isMobile = useIsMobile();
  const [shows, setShows] = useState<FShow[]>([]);
  const [month, setMonth] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<FShow | null>(null);
  const [openDay, setOpenDay] = useState<Date | null>(null);
  const [filterArtist, setFilterArtist] = useState<string>("all");
  const [filterStatuses, setFilterStatuses] = useState<string[]>([]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.functions.invoke("shows-admin", { body: { action: "list" } });
    setShows(((data?.shows ?? []) as FShow[]).filter((s) => s.status !== "cancelada"));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useRealtimeInvalidate({
    channel: "financeiro-agenda",
    tables: ["shows"],
    queryKeys: [],
    debounceMs: 400,
    onEvent: load,
  });

  const artistOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of shows) if (s.artist_id) m.set(s.artist_id, s.artist_nome ?? "—");
    return Array.from(m.entries()).map(([id, nome]) => ({ id, nome }));
  }, [shows]);

  const filtered = useMemo(() => {
    return shows.filter((s) => {
      if (filterArtist !== "all" && s.artist_id !== filterArtist) return false;
      if (filterStatuses.length > 0 && !filterStatuses.includes(effectiveStatus(s))) return false;
      return true;
    });
  }, [shows, filterArtist, filterStatuses]);

  const monthShows = useMemo(() => {
    const ym = format(month, "yyyy-MM");
    return filtered
      .filter((s) => s.data_show?.startsWith(ym))
      .sort((a, b) => a.data_show.localeCompare(b.data_show));
  }, [filtered, month]);

  const events: AgendaEvent[] = useMemo(
    () =>
      filtered.map((s) => ({
        id: s.id,
        date: s.data_show,
        time: s.horario,
        label: s.artist_nome ?? "—",
        status: effectiveStatus(s),
        artistColor: s.artist_cor,
        onClick: () => setActive(s),
      })),
    [filtered],
  );

  const dayShows = useMemo(() => {
    if (!openDay) return [];
    const k = format(openDay, "yyyy-MM-dd");
    return filtered.filter((s) => s.data_show?.startsWith(k));
  }, [filtered, openDay]);

  const stats = useMemo(() => {
    const conf = monthShows.filter((s) => effectiveStatus(s) === "confirmado").length;
    const pend = monthShows.filter((s) => ["pendente", "aguardando_pagamento", "aprovada"].includes(effectiveStatus(s))).length;
    return { total: monthShows.length, conf, pend };
  }, [monthShows]);

  const exportMonth = (kind: "pdf" | "csv") => {
    const cols: Column[] = [
      { header: "Data", key: (r: FShow) => r.data_show.split("-").reverse().join("/") },
      { header: "Hora", key: (r: FShow) => (r.horario ? r.horario.slice(0, 5) : "—") },
      { header: "Artista", key: (r: FShow) => r.artist_nome ?? "—" },
      { header: "Local", key: (r: FShow) => [r.local, r.cidade].filter(Boolean).join(" · ") || "—" },
      { header: "Cachê", key: (r: FShow) => Number(r.cache_total ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), align: "right" },
      { header: "Status", key: (r: FShow) => {
        const eff = effectiveStatus(r);
        return (STATUS_LABEL as any)[eff] ?? EXTRA_LABEL[eff] ?? eff;
      } },
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
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Select value={filterArtist} onValueChange={setFilterArtist}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Artista" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os artistas</SelectItem>
            {artistOptions.map((a) => (
              <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex flex-wrap gap-1">
          {Object.entries(STATUS_COLORS)
            .filter(([k]) => !["rejeitada", "outro"].includes(k))
            .map(([k, v]) => {
              const active = filterStatuses.includes(k);
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() =>
                    setFilterStatuses((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]))
                  }
                  className="text-xs rounded-full px-2 py-1 border transition"
                  style={{
                    background: active ? v.bg : "transparent",
                    color: active ? "white" : undefined,
                    borderColor: v.bg,
                  }}
                >
                  {v.label}
                </button>
              );
            })}
          {filterStatuses.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setFilterStatuses([])}>Limpar</Button>
          )}
        </div>
        <div className="ml-auto">
          <ExportMenu
            label={`Exportar ${format(month, "MMM/yy", { locale: ptBR })}`}
            disabled={monthShows.length === 0}
            onExportPDF={() => exportMonth("pdf")}
            onExportCSV={() => exportMonth("csv")}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Total no mês</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </Card>
        <Card className="p-3 border-green-600/30">
          <p className="text-xs text-muted-foreground">Confirmados</p>
          <p className="text-2xl font-bold text-green-600">{stats.conf}</p>
        </Card>
        <Card className="p-3 border-yellow-500/30">
          <p className="text-xs text-muted-foreground">Pendentes / Aguardando</p>
          <p className="text-2xl font-bold text-yellow-600">{stats.pend}</p>
        </Card>
      </div>

      <Card className="p-4 shadow-soft">
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <MonthCalendar
            month={month}
            onMonthChange={setMonth}
            events={events}
            onSelectDay={setOpenDay}
            isMobile={isMobile}
          />
        )}
      </Card>

      <Sheet open={!!openDay} onOpenChange={(o) => !o && setOpenDay(null)}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="capitalize">
              {openDay ? format(openDay, "EEEE, d 'de' MMMM", { locale: ptBR }) : ""}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            {dayShows.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum show neste dia.</p>
            ) : (
              dayShows.map((s) => {
                const eff = effectiveStatus(s);
                const cls = (STATUS_CLASS as any)[eff] ?? EXTRA_CLASS[eff] ?? "";
                const label = (STATUS_LABEL as any)[eff] ?? EXTRA_LABEL[eff] ?? eff;
                return (
                  <div key={s.id} className="border rounded-md p-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: s.artist_cor ?? "hsl(var(--primary))" }} />
                      <p className="font-medium truncate flex-1">{s.artist_nome ?? "—"}</p>
                      <Badge className={cls}>{label}</Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                      {s.horario && <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{s.horario.slice(0, 5)}</span>}
                      {s.local && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{s.local}{s.cidade ? ` · ${s.cidade}` : ""}</span>}
                      <span>{Number(s.cache_total ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                    </div>
                    <div className="mt-2 flex justify-end">
                      <Button size="sm" variant="outline" onClick={() => { setActive(s); setOpenDay(null); }}>
                        Ver detalhes
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </SheetContent>
      </Sheet>

      {active && (
        <Suspense fallback={null}>
          <ShowDetailsModal show={active} open={!!active} onClose={() => setActive(null)} onChanged={load} />
        </Suspense>
      )}
    </>
  );
}
