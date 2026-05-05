import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { STATUS_CLASS, STATUS_LABEL } from "@/lib/showStatus";
import { lazy, Suspense } from "react";
const ShowDetailsModal = lazy(() => import("@/components/shows/ShowDetailsModal").then(m => ({ default: m.ShowDetailsModal })));
import { AlertTriangle, Clock, DollarSign, Wallet, TrendingUp, TrendingDown, PiggyBank } from "lucide-react";
import { cn } from "@/lib/utils";
import { ExportMenu } from "@/components/ExportMenu";
import { exportCSV, exportPDF, type Column } from "@/lib/exporters";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  startOfMonth, endOfMonth, addMonths, startOfYear, endOfYear, format, parseISO,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, Legend, ResponsiveContainer,
} from "recharts";

interface FinShow {
  id: string;
  artist_id: string;
  artist_nome?: string | null;
  artist_cor?: string | null;
  artist_cache_minimo?: number | null;
  data_show: string;
  local: string | null;
  cidade: string | null;
  cache_total: number;
  total_pago: number;
  status: string;
  vendedor: string | null;
  created_by: string | null;
  confirmado_em: string | null;
  confirmado_por_nome: string | null;
  prazo_comprovante_em: string | null;
  aprovado_em: string | null;
  condicao_pagamento?: string | null;
}

const fmtBRL = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtBRLshort = (n: number) => {
  const v = Number(n || 0);
  if (Math.abs(v) >= 1000) return `R$ ${(v / 1000).toFixed(0)}k`;
  return `R$ ${v.toFixed(0)}`;
};
const fmtDate = (d: string | null) => {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
};
const ymd = (d: Date) => format(d, "yyyy-MM-dd");

const EXTRA_LABEL: Record<string, string> = { atrasado: "ATRASADO" };
const EXTRA_CLASS: Record<string, string> = {
  atrasado: "bg-red-600 hover:bg-red-600 text-white",
};

function effectiveStatus(s: FinShow): string {
  if (
    s.status === "aguardando_pagamento" &&
    s.prazo_comprovante_em &&
    new Date(s.prazo_comprovante_em) < new Date()
  ) {
    return "atrasado";
  }
  return s.status;
}

type PeriodKind = "mes" | "prox_mes" | "3m" | "6m" | "ano" | "custom";
const PERIOD_LABEL: Record<PeriodKind, string> = {
  mes: "Este mês",
  prox_mes: "Próximo mês",
  "3m": "Próximos 3 meses",
  "6m": "Próximos 6 meses",
  ano: "Este ano",
  custom: "Personalizado",
};

function rangeFor(kind: PeriodKind): { from: string; to: string } {
  const now = new Date();
  switch (kind) {
    case "mes": return { from: ymd(startOfMonth(now)), to: ymd(endOfMonth(now)) };
    case "prox_mes": {
      const n = addMonths(now, 1);
      return { from: ymd(startOfMonth(n)), to: ymd(endOfMonth(n)) };
    }
    case "3m": return { from: ymd(startOfMonth(now)), to: ymd(endOfMonth(addMonths(now, 2))) };
    case "6m": return { from: ymd(startOfMonth(now)), to: ymd(endOfMonth(addMonths(now, 5))) };
    case "ano": return { from: ymd(startOfYear(now)), to: ymd(endOfYear(now)) };
    case "custom": return { from: "", to: "" };
  }
}

function periodLabelText(kind: PeriodKind, from: string, to: string): string {
  if (kind === "mes" || kind === "prox_mes") {
    if (!from) return PERIOD_LABEL[kind];
    return format(parseISO(from), "MMMM yyyy", { locale: ptBR }).replace(/^./, (c) => c.toUpperCase());
  }
  if (kind === "ano") return format(parseISO(from), "yyyy");
  if (from && to) return `${fmtDate(from)} → ${fmtDate(to)}`;
  return PERIOD_LABEL[kind];
}

export default function Financeiro() {
  const queryClient = useQueryClient();
  const [active, setActive] = useState<FinShow | null>(null);

  const [fArtist, setFArtist] = useState<string>("all");
  const [fStatus, setFStatus] = useState<string>("all");
  const [period, setPeriod] = useState<PeriodKind>("mes");
  const initialRange = rangeFor("mes");
  const [fFrom, setFFrom] = useState<string>(initialRange.from);
  const [fTo, setFTo] = useState<string>(initialRange.to);

  useEffect(() => {
    if (period === "custom") return;
    const r = rangeFor(period);
    setFFrom(r.from);
    setFTo(r.to);
  }, [period]);

  const finQuery = useQuery({
    queryKey: ["financeiro"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("shows-admin", {
        body: { action: "finance_summary" },
      });
      if (error) throw new Error(error.message);
      return (data?.shows ?? []) as FinShow[];
    },
  });
  const shows = finQuery.data ?? [];
  const loading = finQuery.isLoading;
  const load = () => queryClient.invalidateQueries({ queryKey: ["financeiro"] });

  useRealtimeInvalidate({
    channel: "financeiro-page",
    tables: ["shows", "show_payments"],
    queryKeys: [["financeiro"]],
    debounceMs: 400,
  });

  const artists = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of shows) if (s.artist_id) m.set(s.artist_id, s.artist_nome ?? "—");
    return Array.from(m.entries()).map(([id, nome]) => ({ id, nome }));
  }, [shows]);

  const filtered = useMemo(() => {
    return shows.filter((s) => {
      if (fArtist !== "all" && s.artist_id !== fArtist) return false;
      const eff = effectiveStatus(s);
      if (fStatus !== "all" && eff !== fStatus) return false;
      if (fFrom && s.data_show < fFrom) return false;
      if (fTo && s.data_show > fTo) return false;
      return true;
    });
  }, [shows, fArtist, fStatus, fFrom, fTo]);

  // Cards globais (mantidos)
  const monthIso = new Date().toISOString().slice(0, 7);
  const totals = useMemo(() => {
    let aReceber = 0;
    let recebidoMes = 0;
    let aguardandoPag = 0;
    let aguardandoConfirmacao = 0;
    let atrasados = 0;
    for (const s of shows) {
      const eff = effectiveStatus(s);
      if (eff === "cancelada") continue;
      const restante = Math.max(0, Number(s.cache_total) - Number(s.total_pago));
      if (eff === "confirmado" || eff === "aguardando_pagamento" || eff === "comprovante_enviado" || eff === "atrasado") {
        aReceber += restante;
      }
      if (s.data_show && s.data_show.startsWith(monthIso)) {
        recebidoMes += Number(s.total_pago);
      }
      if (eff === "aguardando_pagamento") aguardandoPag += 1;
      if (eff === "comprovante_enviado") aguardandoConfirmacao += 1;
      if (eff === "atrasado") atrasados += 1;
    }
    return { aReceber, recebidoMes, aguardandoPag, aguardandoConfirmacao, atrasados };
  }, [shows, monthIso]);

  // Previsão sobre o período filtrado
  const previsaoStatuses = new Set(["confirmado", "aguardando_pagamento", "comprovante_enviado", "atrasado"]);
  const periodStats = useMemo(() => {
    let totalShows = 0;
    let cacheTotal = 0;
    let recebido = 0;
    let aReceber = 0;
    let previsaoTotal = 0;
    for (const s of filtered) {
      const eff = effectiveStatus(s);
      if (eff === "cancelada") continue;
      totalShows += 1;
      cacheTotal += Number(s.cache_total || 0);
      recebido += Number(s.total_pago || 0);
      if (previsaoStatuses.has(eff)) {
        previsaoTotal += Number(s.cache_total || 0);
        aReceber += Math.max(0, Number(s.cache_total) - Number(s.total_pago));
      }
    }
    const pct = previsaoTotal > 0 ? Math.min(100, (recebido / previsaoTotal) * 100) : 0;
    return { totalShows, cacheTotal, recebido, aReceber, previsaoTotal, pct };
  }, [filtered]);

  // Gráfico próximos 6 meses (sempre relativo ao hoje)
  const chartData = useMemo(() => {
    const now = new Date();
    const buckets: { key: string; label: string; recebido: number; previsto: number; shows: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const d = addMonths(now, i);
      const key = format(d, "yyyy-MM");
      buckets.push({
        key,
        label: format(d, "MMM/yy", { locale: ptBR }),
        recebido: 0,
        previsto: 0,
        shows: 0,
      });
    }
    const map = new Map(buckets.map((b) => [b.key, b]));
    for (const s of shows) {
      const eff = effectiveStatus(s);
      if (eff === "cancelada") continue;
      if (fArtist !== "all" && s.artist_id !== fArtist) continue;
      const k = (s.data_show ?? "").slice(0, 7);
      const b = map.get(k);
      if (!b) continue;
      b.shows += 1;
      b.recebido += Number(s.total_pago || 0);
      if (previsaoStatuses.has(eff)) {
        b.previsto += Math.max(0, Number(s.cache_total) - Number(s.total_pago));
      }
    }
    return buckets;
  }, [shows, fArtist]);

  const today = new Date();
  const in7 = new Date(today.getTime() + 7 * 86400000);
  const proximos = shows.filter((s) => {
    const d = new Date(s.data_show + "T00:00:00");
    const eff = effectiveStatus(s);
    return d >= today && d <= in7 && eff !== "cancelada" && eff !== "confirmado";
  });
  const atrasados = shows.filter((s) => effectiveStatus(s) === "atrasado");
  const aguardandoConfirm = shows.filter((s) => effectiveStatus(s) === "comprovante_enviado");

  // Agrupar por mês para a tabela quando o período cobre múltiplos meses
  const grouped = useMemo(() => {
    const groups = new Map<string, FinShow[]>();
    const sorted = [...filtered].sort((a, b) => a.data_show.localeCompare(b.data_show));
    for (const s of sorted) {
      const k = (s.data_show ?? "").slice(0, 7);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(s);
    }
    return Array.from(groups.entries()).map(([key, items]) => {
      const cache = items.reduce((a, r) => a + Number(r.cache_total || 0), 0);
      const pago = items.reduce((a, r) => a + Number(r.total_pago || 0), 0);
      const label = format(parseISO(key + "-01"), "MMMM yyyy", { locale: ptBR })
        .replace(/^./, (c) => c.toUpperCase());
      return { key, label, items, cache, pago, restante: Math.max(0, cache - pago) };
    });
  }, [filtered]);
  const showMonthGroups = grouped.length > 1;

  function previsaoProximoPagamento(s: FinShow): string {
    if (Number(s.total_pago) >= Number(s.cache_total)) return "—";
    if (s.prazo_comprovante_em) {
      try { return fmtDate(s.prazo_comprovante_em.slice(0, 10)); } catch { /* */ }
    }
    return s.data_show ? fmtDate(s.data_show) : "—";
  }

  const exportFinanceiro = (kind: "pdf" | "csv") => {
    const cols: Column[] = [
      { header: "Artista", key: (r: FinShow) => r.artist_nome ?? "—" },
      { header: "Data", key: (r: FinShow) => fmtDate(r.data_show) },
      { header: "Local", key: (r: FinShow) => [r.local, r.cidade].filter(Boolean).join(" · ") || "—" },
      { header: "Cachê", key: (r: FinShow) => fmtBRL(Number(r.cache_total)), align: "right" },
      { header: "Recebido", key: (r: FinShow) => fmtBRL(Number(r.total_pago)), align: "right" },
      {
        header: "A receber",
        key: (r: FinShow) => fmtBRL(Math.max(0, Number(r.cache_total) - Number(r.total_pago))),
        align: "right",
      },
      { header: "Previsão", key: (r: FinShow) => previsaoProximoPagamento(r) },
      {
        header: "Status",
        key: (r: FinShow) => {
          const eff = effectiveStatus(r);
          return (STATUS_LABEL as any)[eff] ?? EXTRA_LABEL[eff] ?? eff;
        },
      },
    ];
    const filterLines: string[] = [];
    filterLines.push(`Período: ${PERIOD_LABEL[period]} (${fmtDate(fFrom)} → ${fmtDate(fTo)})`);
    if (fArtist !== "all") {
      const a = artists.find((x) => x.id === fArtist);
      filterLines.push(`Artista: ${a?.nome ?? "—"}`);
    }
    if (fStatus !== "all") filterLines.push(`Status: ${fStatus}`);
    const meta = {
      title: "Financeiro — Previsão de recebimentos",
      filters: filterLines,
      filename: `financeiro-${new Date().toISOString().slice(0, 10)}`,
      summary: [
        { label: "Total de shows", value: String(periodStats.totalShows) },
        { label: "Previsão total", value: fmtBRL(periodStats.previsaoTotal) },
        { label: "Recebido", value: fmtBRL(periodStats.recebido) },
        { label: "A receber", value: fmtBRL(periodStats.aReceber) },
        { label: "% Recebido", value: `${periodStats.pct.toFixed(1)}%` },
      ],
    };
    if (kind === "pdf") exportPDF(filtered, cols, meta);
    else exportCSV(filtered, cols, meta);
  };

  const exportConsolidado = async (kind: "pdf" | "csv") => {
    const { data, error } = await supabase.functions.invoke("shows-admin", {
      body: {
        action: "list_payments_consolidated",
        from: fFrom || null,
        to: fTo || null,
        artist_id: fArtist,
        status: fStatus === "all" ? "all" : fStatus === "confirmado" ? "confirmado" : "em_aberto",
      },
    });
    if (error) return;
    const rows = (data?.rows ?? []) as any[];
    if (rows.length === 0) return;
    const cols: Column[] = [
      { header: "Artista", key: (r: any) => r.artist_nome ?? "—" },
      { header: "Data show", key: (r: any) => fmtDate(r.data_show) },
      { header: "Local", key: (r: any) => [r.local, r.cidade].filter(Boolean).join(" · ") || "—" },
      { header: "Cachê", key: (r: any) => fmtBRL(Number(r.cache_total)), align: "right" },
      { header: "Total pago", key: (r: any) => fmtBRL(Number(r.total_pago_show)), align: "right" },
      { header: "Saldo", key: (r: any) => fmtBRL(Math.max(0, Number(r.saldo_aberto))), align: "right" },
      { header: "Status", key: (r: any) => (STATUS_LABEL as any)[r.status] ?? r.status },
      { header: "Data baixa", key: (r: any) => fmtDate(r.data_pagamento) },
      { header: "Valor baixa", key: (r: any) => fmtBRL(Number(r.valor)), align: "right" },
      { header: "Forma", key: (r: any) => r.forma_pagamento },
      { header: "Confirmado por", key: (r: any) => r.confirmado_por ?? "—" },
    ];
    const totalBaixas = rows.reduce((a, r) => a + Number(r.valor || 0), 0);
    const filterLines: string[] = [];
    if (fArtist !== "all") {
      const a = artists.find((x) => x.id === fArtist);
      filterLines.push(`Artista: ${a?.nome ?? "—"}`);
    }
    if (fStatus !== "all") filterLines.push(`Status: ${fStatus}`);
    if (fFrom) filterLines.push(`De: ${fmtDate(fFrom)}`);
    if (fTo) filterLines.push(`Até: ${fmtDate(fTo)}`);
    const meta = {
      title: "Extrato consolidado de baixas",
      filters: filterLines,
      filename: `extrato-consolidado-${new Date().toISOString().slice(0, 10)}`,
      summary: [
        { label: "Total de baixas", value: String(rows.length) },
        { label: "Valor total das baixas", value: fmtBRL(totalBaixas) },
      ],
    };
    if (kind === "pdf") exportPDF(rows, cols, meta);
    else exportCSV(rows, cols, meta);
  };

  const periodTitle = periodLabelText(period, fFrom, fTo);
  const pctColor =
    periodStats.pct >= 70 ? "text-green-600" :
    periodStats.pct >= 40 ? "text-yellow-600" : "text-red-600";
  const pctBar =
    periodStats.pct >= 70 ? "bg-green-600" :
    periodStats.pct >= 40 ? "bg-yellow-500" : "bg-red-600";

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl md:text-3xl font-semibold">Financeiro</h1>
        <p className="text-muted-foreground mt-1">Pagamentos, comprovantes e fluxo financeiro de todos os shows.</p>
      </header>

      {loading ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="p-4 shadow-soft space-y-3">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-7 w-32" />
              </Card>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Total a receber" value={fmtBRL(totals.aReceber)} icon={<Wallet className="h-4 w-4" />} />
            <StatCard title="Recebido no mês" value={fmtBRL(totals.recebidoMes)} icon={<DollarSign className="h-4 w-4" />} />
            <StatCard title="Aguardando pagamento" value={String(totals.aguardandoPag)} icon={<Clock className="h-4 w-4" />} />
            <StatCard title="Aguardando confirmação" value={String(totals.aguardandoConfirmacao)} icon={<AlertTriangle className="h-4 w-4" />} />
          </div>

          {(atrasados.length > 0 || aguardandoConfirm.length > 0 || proximos.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <AlertList color="red" title={`Pagamento atrasado (${atrasados.length})`} items={atrasados.slice(0, 5)} onOpen={setActive} />
              <AlertList color="orange" title={`Comprovante aguardando confirmação (${aguardandoConfirm.length})`} items={aguardandoConfirm.slice(0, 5)} onOpen={setActive} />
              <AlertList color="yellow" title={`A vencer em 7 dias (${proximos.length})`} items={proximos.slice(0, 5)} onOpen={setActive} />
            </div>
          )}

          {/* Previsão de Recebimentos */}
          <Card className="p-4 md:p-6 shadow-soft space-y-5">
            <div className="flex flex-wrap items-end gap-3 justify-between">
              <div>
                <h2 className="text-lg font-semibold">Previsão de Recebimentos</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Exibindo: <span className="font-medium text-foreground">{periodTitle}</span> · {periodStats.totalShows} shows · {fmtBRL(periodStats.previsaoTotal)}
                </p>
              </div>
              <div className="flex flex-wrap gap-3 items-end">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Período</label>
                  <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKind)}>
                    <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(PERIOD_LABEL) as PeriodKind[]).map((k) => (
                        <SelectItem key={k} value={k}>{PERIOD_LABEL[k]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {period === "custom" && (
                  <>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">De</label>
                      <Input type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} className="w-[160px]" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Até</label>
                      <Input type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} className="w-[160px]" />
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <ForecastCard
                title="A receber"
                value={fmtBRL(periodStats.aReceber)}
                tone="blue"
                icon={<TrendingDown className="h-4 w-4" />}
              />
              <ForecastCard
                title="Recebido"
                value={fmtBRL(periodStats.recebido)}
                tone="green"
                icon={<TrendingUp className="h-4 w-4" />}
              />
              <ForecastCard
                title="Previsão total"
                value={fmtBRL(periodStats.previsaoTotal)}
                tone="gray"
                icon={<PiggyBank className="h-4 w-4" />}
              />
              <Card className="p-4 shadow-soft">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">% Recebido</p>
                </div>
                <p className={cn("text-2xl font-semibold mt-2", pctColor)}>{periodStats.pct.toFixed(1)}%</p>
                <div className="mt-3 h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div className={cn("h-full transition-all", pctBar)} style={{ width: `${periodStats.pct}%` }} />
                </div>
              </Card>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={fmtBRLshort} tick={{ fontSize: 12 }} />
                  <RTooltip
                    formatter={(v: number) => fmtBRL(Number(v))}
                    labelFormatter={(label, payload) => {
                      const p: any = payload?.[0]?.payload;
                      const total = (p?.recebido ?? 0) + (p?.previsto ?? 0);
                      return `${label} · ${p?.shows ?? 0} shows · Total ${fmtBRL(total)}`;
                    }}
                  />
                  <Legend />
                  <Bar dataKey="recebido" name="Recebido" fill="hsl(142 71% 45%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="previsto" name="A receber" fill="hsl(217 91% 60%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </>
      )}

      <Card className="p-4 shadow-soft space-y-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Artista</label>
            <Select value={fArtist} onValueChange={setFArtist}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {artists.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Status</label>
            <Select value={fStatus} onValueChange={setFStatus}>
              <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="aguardando_pagamento">Aguardando pagamento</SelectItem>
                <SelectItem value="comprovante_enviado">Comprovante enviado</SelectItem>
                <SelectItem value="confirmado">Confirmado</SelectItem>
                <SelectItem value="atrasado">Atrasado</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="ghost"
            onClick={() => {
              setFArtist("all");
              setFStatus("all");
              setPeriod("mes");
              const r = rangeFor("mes");
              setFFrom(r.from); setFTo(r.to);
            }}
          >
            Limpar
          </Button>
          <div className="ml-auto flex gap-2">
            <ExportMenu
              label="Exportar shows"
              disabled={filtered.length === 0}
              onExportPDF={() => exportFinanceiro("pdf")}
              onExportCSV={() => exportFinanceiro("csv")}
            />
            <ExportMenu
              label="Extrato consolidado"
              onExportPDF={() => exportConsolidado("pdf")}
              onExportCSV={() => exportConsolidado("csv")}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Artista</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Local</TableHead>
                <TableHead className="text-right">Cachê</TableHead>
                <TableHead className="text-right">Recebido</TableHead>
                <TableHead className="text-right">A receber</TableHead>
                <TableHead>Previsão</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 9 }).map((__, j) => (
                      <TableCell key={j}><div className="h-4 w-full bg-muted rounded animate-pulse" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">Nenhum show encontrado.</TableCell></TableRow>
              ) : (
                grouped.map((g) => (
                  <>
                    {showMonthGroups && (
                      <TableRow key={`h-${g.key}`} className="bg-muted/40 hover:bg-muted/40">
                        <TableCell colSpan={9} className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                          {g.label}
                        </TableCell>
                      </TableRow>
                    )}
                    {g.items.map((s) => {
                      const eff = effectiveStatus(s);
                      const cls = (STATUS_CLASS as any)[eff] ?? EXTRA_CLASS[eff] ?? "";
                      const label = (STATUS_LABEL as any)[eff] ?? EXTRA_LABEL[eff] ?? eff;
                      const cache = Number(s.cache_total);
                      const pago = Number(s.total_pago);
                      const restante = Math.max(0, cache - pago);
                      const quitado = pago >= cache && cache > 0;
                      const parcial = pago > 0 && pago < cache;
                      const atrasado = eff === "atrasado";
                      return (
                        <TableRow key={s.id}>
                          <TableCell>
                            <span className="inline-flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.artist_cor ?? "hsl(var(--primary))" }} />
                              {s.artist_nome ?? "—"}
                            </span>
                          </TableCell>
                          <TableCell>{fmtDate(s.data_show)}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{s.local ?? "—"}{s.cidade ? ` · ${s.cidade}` : ""}</TableCell>
                          <TableCell className="text-right">{fmtBRL(cache)}</TableCell>
                          <TableCell className={cn("text-right", quitado && "text-green-600 font-medium", parcial && "text-yellow-600")}>
                            {fmtBRL(pago)}
                          </TableCell>
                          <TableCell className={cn("text-right", restante === 0 && "text-muted-foreground", restante > 0 && (atrasado ? "text-red-600 font-medium" : "text-blue-600"))}>
                            {restante === 0 ? "—" : fmtBRL(restante)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{previsaoProximoPagamento(s)}</TableCell>
                          <TableCell><Badge className={cls}>{label}</Badge></TableCell>
                          <TableCell><Button size="sm" variant="ghost" onClick={() => setActive(s)}>Abrir</Button></TableCell>
                        </TableRow>
                      );
                    })}
                    {showMonthGroups && (
                      <TableRow key={`s-${g.key}`} className="bg-muted/20 hover:bg-muted/20">
                        <TableCell colSpan={3} className="text-sm font-medium">Subtotal {g.label} — {g.items.length} show(s)</TableCell>
                        <TableCell className="text-right text-sm font-medium">{fmtBRL(g.cache)}</TableCell>
                        <TableCell className="text-right text-sm font-medium">{fmtBRL(g.pago)}</TableCell>
                        <TableCell className="text-right text-sm font-medium">{fmtBRL(g.restante)}</TableCell>
                        <TableCell colSpan={3}></TableCell>
                      </TableRow>
                    )}
                  </>
                ))
              )}
            </TableBody>
            {filtered.length > 0 && (
              <tfoot className="border-t bg-muted/30 font-medium">
                <tr>
                  <td className="p-3 text-sm" colSpan={3}>Total — {periodStats.totalShows} show(s)</td>
                  <td className="p-3 text-sm text-right">{fmtBRL(periodStats.cacheTotal)}</td>
                  <td className="p-3 text-sm text-right text-green-700">{fmtBRL(periodStats.recebido)}</td>
                  <td className="p-3 text-sm text-right text-blue-700">{fmtBRL(periodStats.aReceber)}</td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            )}
          </Table>
        </div>
      </Card>

      {active && (
        <Suspense fallback={null}>
          <ShowDetailsModal show={active as any} open={!!active} onClose={() => setActive(null)} onChanged={load} />
        </Suspense>
      )}
    </div>
  );
}

function StatCard({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return (
    <Card className="p-4 shadow-soft">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{title}</p>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <p className="text-2xl font-semibold mt-2">{value}</p>
    </Card>
  );
}

function ForecastCard({
  title, value, tone, icon,
}: { title: string; value: string; tone: "blue" | "green" | "gray"; icon: React.ReactNode }) {
  const toneCls = {
    blue: "text-blue-600",
    green: "text-green-600",
    gray: "text-muted-foreground",
  }[tone];
  return (
    <Card className="p-4 shadow-soft">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{title}</p>
        <span className={toneCls}>{icon}</span>
      </div>
      <p className={cn("text-2xl font-semibold mt-2", toneCls)}>{value}</p>
    </Card>
  );
}

function AlertList({
  color,
  title,
  items,
  onOpen,
}: {
  color: "red" | "orange" | "yellow";
  title: string;
  items: FinShow[];
  onOpen: (s: FinShow) => void;
}) {
  const border = {
    red: "border-red-500/50 bg-red-500/5",
    orange: "border-orange-500/50 bg-orange-500/5",
    yellow: "border-yellow-500/50 bg-yellow-500/5",
  }[color];
  return (
    <Card className={cn("p-4 shadow-soft border", border)}>
      <p className="font-medium mb-2">{title}</p>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nada por aqui.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((s) => (
            <li key={s.id} className="flex items-center justify-between text-sm gap-2">
              <span className="truncate">
                <strong>{s.artist_nome ?? "—"}</strong> · {fmtDate(s.data_show)}{s.cidade ? ` · ${s.cidade}` : ""}
              </span>
              <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => onOpen(s)}>Abrir</Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
