import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { STATUS_CLASS, STATUS_LABEL } from "@/lib/showStatus";
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

interface RShow {
  id: string;
  artist_id: string;
  artist_nome?: string | null;
  data_show: string;
  cache_total: number;
  total_pago: number;
  total_despesas: number;
  status: string;
  vendedor: string | null;
  created_by: string | null;
  local?: string | null;
  cidade?: string | null;
  remarcado_count?: number | null;
  cancelado_motivo?: string | null;
  cancelado_em?: string | null;
  ultima_remarcacao_em?: string | null;
}

const fmtBRL = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const MONTHS_PT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

export default function Relatorios() {
  const { roles } = useAuth();
  const isManager = roles.includes("gerente");
  const isFinanceiro = roles.includes("financeiro");
  const isVendedor = roles.includes("vendedor");

  const [shows, setShows] = useState<RShow[]>([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const [year, setYear] = useState<string>(String(now.getFullYear()));
  const [month, setMonth] = useState<string>(String(now.getMonth() + 1).padStart(2, "0"));
  const [artistId, setArtistId] = useState<string>("all");
  const [periodo, setPeriodo] = useState<"semana" | "mes">("mes");
  const [weekRef, setWeekRef] = useState<string>(toIsoDate(now)); // any date inside the week

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke("shows-admin", {
        body: { action: "finance_summary" },
      });
      if (!error) setShows((data?.shows ?? []) as RShow[]);
      setLoading(false);
    })();
  }, []);

  const artists = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of shows) if (s.artist_id) m.set(s.artist_id, s.artist_nome ?? "—");
    return Array.from(m.entries()).map(([id, nome]) => ({ id, nome }));
  }, [shows]);

  const filtered = useMemo(() => {
    return shows.filter((s) => {
      if (!s.data_show) return false;
      if (year !== "all" && !s.data_show.startsWith(year)) return false;
      if (month !== "all" && s.data_show.slice(5, 7) !== month) return false;
      if (artistId !== "all" && s.artist_id !== artistId) return false;
      return true;
    });
  }, [shows, year, month, artistId]);

  // ---------- AGREGAÇÕES ----------
  const byArtist = useMemo(() => {
    const m = new Map<string, { nome: string; shows: number; bruto: number; despesas: number; liquido: number }>();
    for (const s of filtered) {
      if (s.status === "cancelada") continue;
      const k = s.artist_id;
      if (!m.has(k)) m.set(k, { nome: s.artist_nome ?? "—", shows: 0, bruto: 0, despesas: 0, liquido: 0 });
      const r = m.get(k)!;
      r.shows += 1;
      r.bruto += Number(s.cache_total);
      r.despesas += Number(s.total_despesas);
      r.liquido = r.bruto - r.despesas;
    }
    return Array.from(m.values()).sort((a, b) => b.bruto - a.bruto);
  }, [filtered]);

  const byVendedor = useMemo(() => {
    const m = new Map<string, { nome: string; total: number; volume: number; aprovados: number; rejeitados: number; cancelados: number }>();
    for (const s of filtered) {
      const k = s.vendedor ?? "—";
      if (!m.has(k)) m.set(k, { nome: k, total: 0, volume: 0, aprovados: 0, rejeitados: 0, cancelados: 0 });
      const r = m.get(k)!;
      r.total += 1;
      r.volume += Number(s.cache_total);
      if (s.status === "confirmado" || s.status === "aguardando_pagamento" || s.status === "comprovante_enviado" || s.status === "aprovada") r.aprovados += 1;
      if (s.status === "cancelada") r.cancelados += 1;
    }
    return Array.from(m.values()).sort((a, b) => b.volume - a.volume);
  }, [filtered]);

  const monthlyEvolution = useMemo(() => {
    const map = new Map<string, { mes: string; bruto: number; pago: number }>();
    for (const s of filtered) {
      if (s.status === "cancelada") continue;
      const ym = s.data_show.slice(0, 7);
      if (!map.has(ym)) map.set(ym, { mes: ym, bruto: 0, pago: 0 });
      const r = map.get(ym)!;
      r.bruto += Number(s.cache_total);
      r.pago += Number(s.total_pago);
    }
    return Array.from(map.values())
      .sort((a, b) => a.mes.localeCompare(b.mes))
      .map((r) => ({
        ...r,
        label: `${MONTHS_PT[Number(r.mes.slice(5, 7)) - 1]}/${r.mes.slice(2, 4)}`,
      }));
  }, [filtered]);

  const consolidado = useMemo(() => {
    let realizados = 0, cancelados = 0, remarcados = 0;
    for (const s of filtered) {
      if (s.status === "cancelada") cancelados += 1;
      else if (s.status === "confirmado") realizados += 1;
    }
    // remarcados: pega via shows.remarcado_count > 0 (não temos direto aqui, mantemos zero por ora)
    return { realizados, cancelados, remarcados };
  }, [filtered]);

  const years = useMemo(() => {
    const y = new Set<string>();
    for (const s of shows) if (s.data_show) y.add(s.data_show.slice(0, 4));
    return Array.from(y).sort().reverse();
  }, [shows]);

  // ---------- PERMISSÕES ----------
  if (roles.includes("artista") && roles.length === 1) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold">Relatórios</h1>
        <p className="text-muted-foreground mt-2">Você não tem acesso a esta seção.</p>
      </div>
    );
  }

  const showArtistTab = isManager || isFinanceiro || isVendedor;
  const showVendedoresTab = isManager || isFinanceiro;
  const showGeralTab = isManager || isFinanceiro;
  const showShowsTab = isManager || isFinanceiro || isVendedor;
  const defaultTab = showShowsTab ? "shows" : showArtistTab ? "artista" : showVendedoresTab ? "vendedores" : "geral";

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl md:text-3xl font-semibold">Relatórios</h1>
        <p className="text-muted-foreground mt-1">Visão consolidada por artista, vendedor e produtora.</p>
      </header>

      {/* Filtros */}
      <Card className="p-4 flex flex-wrap gap-3 items-end shadow-soft">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Ano</label>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Mês</label>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {MONTHS_PT.map((m, i) => (
                <SelectItem key={m} value={String(i + 1).padStart(2, "0")}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Artista</label>
          <Select value={artistId} onValueChange={setArtistId}>
            <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {artists.map((a) => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Tabs defaultValue={defaultTab}>
        <TabsList>
          {showArtistTab && <TabsTrigger value="artista">Por artista</TabsTrigger>}
          {showVendedoresTab && <TabsTrigger value="vendedores">Vendedores</TabsTrigger>}
          {showGeralTab && <TabsTrigger value="geral">Geral da produtora</TabsTrigger>}
        </TabsList>

        {showArtistTab && (
          <TabsContent value="artista" className="space-y-4 mt-4">
            <Card className="p-4 shadow-soft">
              <h3 className="font-medium mb-3">Resumo por artista</h3>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Artista</TableHead>
                      <TableHead className="text-right">Shows</TableHead>
                      <TableHead className="text-right">Bruto</TableHead>
                      <TableHead className="text-right">Despesas</TableHead>
                      <TableHead className="text-right">Líquido</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Carregando…</TableCell></TableRow>
                    ) : byArtist.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Sem dados no período.</TableCell></TableRow>
                    ) : byArtist.map((r) => (
                      <TableRow key={r.nome}>
                        <TableCell>{r.nome}</TableCell>
                        <TableCell className="text-right">{r.shows}</TableCell>
                        <TableCell className="text-right">{fmtBRL(r.bruto)}</TableCell>
                        <TableCell className="text-right">{fmtBRL(r.despesas)}</TableCell>
                        <TableCell className="text-right font-medium">{fmtBRL(r.liquido)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>

            {artistId !== "all" && (
              <Card className="p-4 shadow-soft">
                <h3 className="font-medium mb-3">Shows do artista no período</h3>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Local</TableHead>
                        <TableHead className="text-right">Cachê</TableHead>
                        <TableHead className="text-right">Pago</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Sem shows.</TableCell></TableRow>
                      ) : filtered.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell>{s.data_show.split("-").reverse().join("/")}</TableCell>
                          <TableCell className="max-w-[260px] truncate">{(s as any).local ?? "—"}</TableCell>
                          <TableCell className="text-right">{fmtBRL(Number(s.cache_total))}</TableCell>
                          <TableCell className="text-right">{fmtBRL(Number(s.total_pago))}</TableCell>
                          <TableCell>
                            <Badge className={(STATUS_CLASS as any)[s.status] ?? ""}>
                              {(STATUS_LABEL as any)[s.status] ?? s.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            )}
          </TabsContent>
        )}

        {showVendedoresTab && (
          <TabsContent value="vendedores" className="space-y-4 mt-4">
            <Card className="p-4 shadow-soft">
              <h3 className="font-medium mb-3">Ranking de vendedores</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byVendedor.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="nome" />
                    <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => fmtBRL(v)} />
                    <Bar dataKey="volume" fill="hsl(var(--primary))" name="Volume (R$)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-4 shadow-soft">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vendedor</TableHead>
                      <TableHead className="text-right">Minutas</TableHead>
                      <TableHead className="text-right">Aprovadas</TableHead>
                      <TableHead className="text-right">Canceladas</TableHead>
                      <TableHead className="text-right">Taxa aprovação</TableHead>
                      <TableHead className="text-right">Volume</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byVendedor.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Sem dados.</TableCell></TableRow>
                    ) : byVendedor.map((v) => (
                      <TableRow key={v.nome}>
                        <TableCell>{v.nome}</TableCell>
                        <TableCell className="text-right">{v.total}</TableCell>
                        <TableCell className="text-right">{v.aprovados}</TableCell>
                        <TableCell className="text-right">{v.cancelados}</TableCell>
                        <TableCell className="text-right">{v.total ? `${Math.round((v.aprovados / v.total) * 100)}%` : "—"}</TableCell>
                        <TableCell className="text-right font-medium">{fmtBRL(v.volume)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>
        )}

        {showGeralTab && (
          <TabsContent value="geral" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <SimpleStat title="Shows realizados" value={consolidado.realizados} />
              <SimpleStat title="Shows cancelados" value={consolidado.cancelados} />
              <SimpleStat title="Faturamento bruto" value={fmtBRL(byArtist.reduce((a, r) => a + r.bruto, 0))} />
            </div>

            <Card className="p-4 shadow-soft">
              <h3 className="font-medium mb-3">Evolução mensal de faturamento</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyEvolution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => fmtBRL(v)} />
                    <Legend />
                    <Line type="monotone" dataKey="bruto" stroke="hsl(var(--primary))" name="Bruto" />
                    <Line type="monotone" dataKey="pago" stroke="hsl(var(--accent))" name="Pago" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-4 shadow-soft">
              <h3 className="font-medium mb-3">Comparativo por artista</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byArtist}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="nome" />
                    <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => fmtBRL(v)} />
                    <Legend />
                    <Bar dataKey="bruto" fill="hsl(var(--primary))" name="Bruto" />
                    <Bar dataKey="liquido" fill="hsl(var(--accent))" name="Líquido" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function SimpleStat({ title, value }: { title: string; value: string | number }) {
  return (
    <Card className="p-4 shadow-soft">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{title}</p>
      <p className="text-2xl font-semibold mt-2">{value}</p>
    </Card>
  );
}
