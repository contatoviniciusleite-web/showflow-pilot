import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertTriangle, Clock, FileText, XCircle, CalendarDays, Wallet, TrendingUp, Trophy, ShieldCheck,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import { StatCard } from "./StatCard";
import { PeriodFilter } from "./PeriodFilter";
import { AlertDetailSheet, type AlertShow } from "./AlertDetailSheet";
import {
  Period, fmtBRL, fmtDate, getMonthRange, getRangeFor, inRange, isApprovedStatus,
  sumCache, monthLabel, DASHBOARD_THRESHOLDS, PERIOD_LABEL,
} from "@/lib/dashboard";
import { STATUS_CLASS, STATUS_LABEL, ShowStatus } from "@/lib/showStatus";

interface ShowFull {
  id: string;
  artist_id: string;
  artist_nome: string | null;
  artist_cor: string | null;
  data_show: string;
  status: ShowStatus;
  cache_total: number;
  local: string | null;
  cidade: string | null;
  vendedor: string | null;
  created_by: string | null;
  created_at: string;
  prazo_comprovante_em: string | null;
  auto_aprovado?: boolean | null;
  auto_aprovado_em?: string | null;
  aprovado_por?: string | null;
}

const AUTO_BADGE = "bg-yellow-500/15 text-yellow-700 border border-yellow-500/30 hover:bg-yellow-500/20";

export function GerenciaDashboard() {
  const { user, roles } = useAuth();
  const [period, setPeriod] = useState<Period>("mes");
  const [shows, setShows] = useState<ShowFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterArtist, setFilterArtist] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [chartScale, setChartScale] = useState<"mes" | "ano">("mes");
  const [auditPeriod, setAuditPeriod] = useState<Period>("mes");
  const [profileMap, setProfileMap] = useState<Record<string, string>>({});
  const [alertOpen, setAlertOpen] = useState<null | "atrasado" | "contratos" | "cancelados" | "aguardando">(null);

  const isFinanceiro = roles.includes("financeiro") && !roles.includes("gerente");

  const refetch = async () => {
    const r = await supabase.functions.invoke("shows-admin", { body: { action: "list" } });
    const list = (r.data?.shows ?? []) as ShowFull[];
    setShows(list);
    setLoading(false);

    // Busca nomes dos gerentes que aprovaram (para auditoria).
    const ids = Array.from(
      new Set(list.filter((s) => s.auto_aprovado && s.aprovado_por).map((s) => s.aprovado_por as string)),
    );
    if (ids.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("id,nome").in("id", ids);
      const map: Record<string, string> = {};
      (profs ?? []).forEach((p: { id: string; nome: string | null }) => {
        map[p.id] = p.nome ?? p.id.slice(0, 8);
      });
      setProfileMap(map);
    }
  };

  useEffect(() => {
    refetch();
    const ch = supabase
      .channel("gerencia-dash")
      .on("postgres_changes", { event: "*", schema: "public", table: "shows" }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const range = useMemo(() => getRangeFor(period), [period]);
  const month = useMemo(() => getMonthRange(), []);
  const showsPeriodo = useMemo(
    () => shows.filter((s) => inRange(s.data_show, range.start, range.end)),
    [shows, range],
  );

  // ===== Alertas =====
  const nowMs = Date.now();
  const pagAtrasado = shows.filter(
    (s) => s.status === "aguardando_pagamento" && s.prazo_comprovante_em && new Date(s.prazo_comprovante_em).getTime() < nowMs,
  );
  const limiteContrato = nowMs - DASHBOARD_THRESHOLDS.contratoPendenteDias * 24 * 3600 * 1000;
  const contratosVelhos = shows.filter(
    (s) => s.status === "pendente" && new Date(s.created_at).getTime() < limiteContrato,
  );
  const canceladosMes = shows.filter(
    (s) => s.status === "cancelada" && inRange(s.data_show, month.start, month.end),
  );
  const aguardandoAprov = shows.filter((s) => s.status === "pendente");

  // ===== Por artista (mês) =====
  const artistMap = new Map<string, { id: string; nome: string; cor: string; confirmados: number; pendentes: number; faturamento: number; pendenteValor: number; proximo?: ShowFull }>();
  for (const s of shows) {
    if (!s.artist_id) continue;
    if (!artistMap.has(s.artist_id)) {
      artistMap.set(s.artist_id, { id: s.artist_id, nome: s.artist_nome ?? "—", cor: s.artist_cor ?? "#888", confirmados: 0, pendentes: 0, faturamento: 0, pendenteValor: 0 });
    }
    const e = artistMap.get(s.artist_id)!;
    if (inRange(s.data_show, month.start, month.end)) {
      if (isApprovedStatus(s.status)) {
        e.confirmados += 1;
        e.faturamento += Number(s.cache_total ?? 0);
      } else if (s.status === "pendente") {
        e.pendentes += 1;
        e.pendenteValor += Number(s.cache_total ?? 0);
      }
    }
    const today = new Date().toISOString().slice(0, 10);
    if (s.data_show >= today && s.status !== "cancelada") {
      if (!e.proximo || s.data_show < e.proximo.data_show) e.proximo = s;
    }
  }
  const artistList = Array.from(artistMap.values()).sort((a, b) => (b.faturamento + b.pendenteValor) - (a.faturamento + a.pendenteValor));

  // ===== Vendedores no período =====
  const vendMap = new Map<string, { nome: string; volume: number; total: number; aprovadas: number; rejeitadas: number }>();
  for (const s of showsPeriodo) {
    const key = s.vendedor || s.created_by || "—";
    if (!vendMap.has(key)) vendMap.set(key, { nome: key, volume: 0, total: 0, aprovadas: 0, rejeitadas: 0 });
    const v = vendMap.get(key)!;
    v.total += 1;
    if (isApprovedStatus(s.status)) {
      v.aprovadas += 1;
      v.volume += Number(s.cache_total ?? 0);
    }
    if (s.status === "cancelada") v.rejeitadas += 1;
  }
  const vendedores = Array.from(vendMap.values()).sort((a, b) => b.volume - a.volume);

  // ===== Lista de shows do mês =====
  const showsMes = shows.filter((s) => inRange(s.data_show, month.start, month.end));
  const filtrados = showsMes.filter((s) =>
    (filterArtist === "all" || s.artist_id === filterArtist) &&
    (filterStatus === "all" || s.status === filterStatus),
  );
  const totalAReceber = sumCache(filtrados.filter((s) => s.status === "aguardando_pagamento" || s.status === "comprovante_enviado"));
  const totalRecebido = sumCache(filtrados.filter((s) => s.status === "confirmado"));
  const totalEmAberto = sumCache(filtrados.filter((s) => s.status === "pendente" || s.status === "aprovada"));

  // ===== Gráficos =====
  const year = new Date().getFullYear();
  const evolucao = Array.from({ length: 12 }, (_, m) => {
    const start = `${year}-${String(m + 1).padStart(2, "0")}-01`;
    const endD = new Date(year, m + 1, 0);
    const end = `${year}-${String(m + 1).padStart(2, "0")}-${String(endD.getDate()).padStart(2, "0")}`;
    const total = sumCache(shows.filter((s) => isApprovedStatus(s.status) && inRange(s.data_show, start, end)));
    const totalAnterior = sumCache(shows.filter((s) => {
      const sy = parseInt(s.data_show.slice(0, 4));
      const sm = parseInt(s.data_show.slice(5, 7));
      return sy === year - 1 && sm === m + 1 && isApprovedStatus(s.status);
    }));
    return { mes: monthLabel(m), atual: total, anterior: totalAnterior };
  });

  const showsPorArtista = artistList.slice(0, 10).map((a) => ({
    nome: a.nome.length > 12 ? a.nome.slice(0, 12) + "…" : a.nome,
    shows: showsPeriodo.filter((s) => s.artist_id === a.id && isApprovedStatus(s.status)).length,
    cor: a.cor,
  }));

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold">Olá{user?.email ? `, ${user.email.split("@")[0]}` : ""}</h1>
          <p className="text-muted-foreground mt-1">
            Visão consolidada — {PERIOD_LABEL[period].toLowerCase()}.{isFinanceiro && " Painel financeiro."}
          </p>
        </div>
        <PeriodFilter value={period} onChange={setPeriod} />
      </div>

      {/* ===== Alertas ===== */}
      <h2 className="text-sm uppercase tracking-wider text-muted-foreground mb-3">Alertas</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Pagamento atrasado" value={String(pagAtrasado.length)} icon={AlertTriangle} tone="red" highlight onClick={() => setAlertOpen("atrasado")} hint="Clique para ver lista" />
        <StatCard label={`Contratos pendentes >${DASHBOARD_THRESHOLDS.contratoPendenteDias}d`} value={String(contratosVelhos.length)} icon={Clock} tone="amber" onClick={() => setAlertOpen("contratos")} hint="Clique para ver lista" />
        <StatCard label="Cancelados no mês" value={String(canceladosMes.length)} icon={XCircle} tone="red" onClick={() => setAlertOpen("cancelados")} hint="Clique para ver lista" />
        <StatCard label="Aguardando aprovação" value={String(aguardandoAprov.length)} icon={FileText} tone="orange" onClick={() => setAlertOpen("aguardando")} hint="Clique para ver lista" />
      </div>

      {(() => {
        const cfg = {
          atrasado: { title: "Pagamentos atrasados", description: "Shows aguardando pagamento com prazo de comprovante já vencido.", data: pagAtrasado, extra: "prazo" as const },
          contratos: { title: `Contratos pendentes há mais de ${DASHBOARD_THRESHOLDS.contratoPendenteDias} dias`, description: "Minutas criadas que continuam pendentes de aprovação.", data: contratosVelhos, extra: "criado" as const },
          cancelados: { title: "Shows cancelados no mês", description: "Shows com status cancelada no mês corrente.", data: canceladosMes, extra: "cancelado_em" as const },
          aguardando: { title: "Shows aguardando aprovação", description: "Minutas pendentes de autorização.", data: aguardandoAprov, extra: "criado" as const },
        };
        const current = alertOpen ? cfg[alertOpen] : null;
        return (
          <AlertDetailSheet
            open={alertOpen !== null}
            onOpenChange={(o) => { if (!o) setAlertOpen(null); }}
            title={current?.title ?? ""}
            description={current?.description}
            shows={(current?.data ?? []) as AlertShow[]}
            artists={artistList.map((a) => ({ id: a.id, nome: a.nome }))}
            extraColumn={current?.extra}
          />
        );
      })()}

      {/* ===== Por artista ===== */}
      <h2 className="text-sm uppercase tracking-wider text-muted-foreground mb-3">Artistas — mês atual</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {artistList.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum artista cadastrado.</p>
        ) : artistList.map((a) => (
          <Card key={a.id} className="p-5 shadow-soft">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-9 w-9 rounded-full" style={{ background: a.cor }} />
              <div className="min-w-0">
                <p className="font-semibold truncate">{a.nome}</p>
                <p className="text-xs text-muted-foreground">
                  {a.confirmados} confirmado(s){a.pendentes > 0 ? ` · ${a.pendentes} pendente(s)` : ""}
                </p>
              </div>
            </div>
            <div className="text-sm space-y-1">
              <p>
                <Wallet className="h-3.5 w-3.5 inline mr-1 text-muted-foreground" />
                <span className="text-green-600 font-medium">{fmtBRL(a.faturamento)}</span>
                <span className="text-muted-foreground"> confirmado</span>
              </p>
              {a.pendenteValor > 0 && (
                <p>
                  <Clock className="h-3.5 w-3.5 inline mr-1 text-amber-600" />
                  <span className="text-amber-600 font-medium">{fmtBRL(a.pendenteValor)}</span>
                  <span className="text-muted-foreground"> aguardando aprovação</span>
                </p>
              )}
              <p className="text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5 inline mr-1" />
                {a.proximo ? `Próximo: ${fmtDate(a.proximo.data_show)}${a.proximo.cidade ? ` · ${a.proximo.cidade}` : ""}` : "Sem próximos shows"}
              </p>
            </div>
          </Card>
        ))}
      </div>

      {/* ===== Vendedores ===== */}
      <h2 className="text-sm uppercase tracking-wider text-muted-foreground mb-3">Performance de vendedores</h2>
      <Card className="p-6 shadow-soft mb-8">
        {vendedores.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem dados de vendedores no período.</p>
        ) : (
          <ul className="divide-y">
            {vendedores.map((v, i) => {
              const taxa = v.total > 0 ? Math.round((v.aprovadas / v.total) * 100) : 0;
              return (
                <li key={v.nome} className="py-3 flex items-center gap-3">
                  <div className="h-8 w-8 rounded-md bg-accent/10 flex items-center justify-center text-sm font-bold text-accent">
                    {i === 0 ? <Trophy className="h-4 w-4" /> : i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{v.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {v.total} minuta(s) · {v.aprovadas} aprovada(s) · {v.rejeitadas} cancelada(s) · {taxa}% aprovação
                    </p>
                  </div>
                  <span className="text-sm font-semibold shrink-0">{fmtBRL(v.volume)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* ===== Auditoria de auto-aprovações ===== */}
      {(() => {
        const auditRange = getRangeFor(auditPeriod);
        const auditList = shows
          .filter((s) => s.auto_aprovado && inRange(s.data_show, auditRange.start, auditRange.end))
          .sort((a, b) => (b.auto_aprovado_em ?? "").localeCompare(a.auto_aprovado_em ?? ""));
        const auditTotal = sumCache(auditList);
        return (
          <>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
              <h2 className="text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-yellow-600" /> Auto-aprovações ({PERIOD_LABEL[auditPeriod].toLowerCase()})
              </h2>
              <PeriodFilter value={auditPeriod} onChange={setAuditPeriod} />
            </div>
            <Card className="p-6 shadow-soft mb-8">
              <div className="flex items-center justify-between mb-3 text-sm">
                <span className="text-muted-foreground">{auditList.length} minuta(s) auto-aprovada(s)</span>
                <span className="font-semibold">{fmtBRL(auditTotal)}</span>
              </div>
              {auditList.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma auto-aprovação no período.</p>
              ) : (
                <ul className="divide-y">
                  {auditList.map((s) => (
                    <li key={s.id} className="py-3 flex items-center justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{s.artist_nome ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">
                          Gerente: {s.aprovado_por ? (profileMap[s.aprovado_por] ?? s.aprovado_por.slice(0, 8)) : "—"}
                          {" · "}Show: {fmtDate(s.data_show)}
                          {s.auto_aprovado_em && ` · em ${new Date(s.auto_aprovado_em).toLocaleString("pt-BR")}`}
                        </p>
                      </div>
                      <span className="font-semibold shrink-0">{fmtBRL(Number(s.cache_total ?? 0))}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </>
        );
      })()}

      {/* ===== Shows do mês ===== */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
        <h2 className="text-sm uppercase tracking-wider text-muted-foreground">Shows do mês</h2>
        <div className="flex flex-wrap gap-2">
          <Select value={filterArtist} onValueChange={setFilterArtist}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Artista" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os artistas</SelectItem>
              {artistList.map((a) => (<SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {Object.entries(STATUS_LABEL).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-3">
        <StatCard label="Total a receber" value={fmtBRL(totalAReceber)} icon={Wallet} tone="amber" />
        <StatCard label="Total recebido" value={fmtBRL(totalRecebido)} icon={Wallet} tone="green" />
        <StatCard label="Em aberto (pendente/aprovada)" value={fmtBRL(totalEmAberto)} icon={Wallet} tone="blue" />
      </div>
      <Card className="p-6 shadow-soft mb-8">
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : filtrados.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum show no mês com esses filtros. <Link to="/shows" className="text-accent underline">Ver todos</Link>.</p>
        ) : (
          <ul className="divide-y">
            {filtrados.slice().sort((a, b) => a.data_show.localeCompare(b.data_show)).map((s) => (
              <li key={s.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">{s.artist_nome ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">
                    {fmtDate(s.data_show)}{s.cidade ? ` · ${s.cidade}` : ""} · {fmtBRL(Number(s.cache_total ?? 0))}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {s.auto_aprovado && (
                    <Badge className={AUTO_BADGE} title="Minuta aprovada pelo próprio criador (gerente)">
                      <ShieldCheck className="h-3 w-3 mr-1" /> Auto aprovado
                    </Badge>
                  )}
                  <Badge className={STATUS_CLASS[s.status] ?? ""}>{STATUS_LABEL[s.status] ?? s.status}</Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* ===== Gráficos ===== */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm uppercase tracking-wider text-muted-foreground">Gráficos</h2>
        <Select value={chartScale} onValueChange={(v) => setChartScale(v as "mes" | "ano")}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="mes">Mensal</SelectItem>
            <SelectItem value="ano">Anual</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card className="p-6 shadow-soft">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-accent" />
            <h3 className="font-semibold">Evolução de faturamento ({year})</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolucao}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => fmtBRL(v)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Line type="monotone" dataKey="atual" stroke="hsl(var(--accent))" strokeWidth={2} name={String(year)} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6 shadow-soft">
          <h3 className="font-semibold mb-3">Shows por artista — {PERIOD_LABEL[period].toLowerCase()}</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={showsPorArtista}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="nome" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Bar dataKey="shows" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="p-6 shadow-soft">
        <h3 className="font-semibold mb-3">Comparativo {year} vs {year - 1}</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={evolucao}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => fmtBRL(v)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
              <Legend />
              <Line type="monotone" dataKey="atual" stroke="hsl(var(--accent))" strokeWidth={2} name={String(year)} />
              <Line type="monotone" dataKey="anterior" stroke="hsl(var(--muted-foreground))" strokeWidth={2} strokeDasharray="4 4" name={String(year - 1)} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
