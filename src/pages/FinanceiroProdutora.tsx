import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { canManageProducerFinance, canViewProducerFinance } from "@/lib/permissions";
import {
  REVENUE_TYPES, EXPENSE_CATEGORIES, revenueMeta, expenseMeta, fmtBRL,
  monthRefOf, rangeForPreset, type PeriodPreset,
} from "@/lib/producerFinance";
import { getCategoria, getTipoDespesa } from "@/lib/expenseCategories";
import { RevenueDialog } from "@/components/financeiro-produtora/RevenueDialog";
import { ExpenseDialog } from "@/components/financeiro-produtora/ExpenseDialog";
import { RecurringExpenseDialog } from "@/components/financeiro-produtora/RecurringExpenseDialog";
import { MarkExpensePaidDialog } from "@/components/financeiro-produtora/MarkExpensePaidDialog";
import { Plus, Pencil, Trash2, CheckCircle2, XCircle, AlertTriangle, TrendingUp, TrendingDown, Briefcase, Wallet } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

type Artist = { id: string; nome: string };
type Revenue = any;
type Expense = any;
type Recurring = any;
type Commission = any;

const fmtDate = (s: string | null) => s ? format(parseISO(s), "dd/MM/yyyy", { locale: ptBR }) : "—";

export default function FinanceiroProdutora() {
  const { roles } = useAuth();
  const canManage = canManageProducerFinance(roles);
  const canView = canViewProducerFinance(roles);

  const [tab, setTab] = useState("overview");
  const [period, setPeriod] = useState<PeriodPreset>("month");
  const [customFrom, setCustomFrom] = useState<string>(monthRefOf(new Date()) + "-01");
  const [customTo, setCustomTo] = useState<string>(new Date().toISOString().slice(0, 10));

  const [artists, setArtists] = useState<Artist[]>([]);
  const [revenues, setRevenues] = useState<Revenue[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [recurring, setRecurring] = useState<Recurring[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialogs
  const [revOpen, setRevOpen] = useState(false);
  const [editRev, setEditRev] = useState<Revenue | null>(null);
  const [expOpen, setExpOpen] = useState(false);
  const [editExp, setEditExp] = useState<Expense | null>(null);
  const [recOpen, setRecOpen] = useState(false);
  const [editRec, setEditRec] = useState<Recurring | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [payExp, setPayExp] = useState<Expense | null>(null);

  // Filtros aba receitas
  const [filterArtist, setFilterArtist] = useState("all");
  const [filterRevType, setFilterRevType] = useState("all");
  const [filterRevStatus, setFilterRevStatus] = useState("all");
  // Filtros comissão
  const [commArtist, setCommArtist] = useState("all");

  const range = useMemo(() => {
    if (period === "custom") return { from: new Date(customFrom + "T00:00:00"), to: new Date(customTo + "T23:59:59") };
    return rangeForPreset(period);
  }, [period, customFrom, customTo]);

  const fromIso = range.from.toISOString().slice(0, 10);
  const toIso = range.to.toISOString().slice(0, 10);

  const load = async () => {
    setLoading(true);
    try {
      const [a, r, e, rec, com] = await Promise.all([
        supabase.from("artists").select("id, nome").eq("ativo", true).order("nome"),
        supabase.from("producer_revenues" as any).select("*")
          .gte("data_recebimento", fromIso).lte("data_recebimento", toIso)
          .order("data_recebimento", { ascending: false }),
        supabase.from("producer_expenses" as any).select("*")
          .order("data_vencimento", { ascending: true, nullsFirst: false }),
        supabase.from("producer_recurring_expenses" as any).select("*").order("dia_vencimento"),
        supabase.from("producer_commission_balance" as any)
          .select("*, closing:weekly_closings(semana_inicio, semana_fim, status, artist_id)")
          .order("created_at", { ascending: false }),
      ]);
      setArtists((a.data ?? []) as any);
      setRevenues((r.data ?? []) as any);
      setExpenses((e.data ?? []) as any);
      setRecurring((rec.data ?? []) as any);
      setCommissions((com.data ?? []) as any);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (canView) load(); }, [fromIso, toIso, canView]);

  if (!canView) {
    return <div className="p-6">Acesso negado.</div>;
  }

  // ===== Cálculos visão geral =====
  const totalRevenues = revenues.reduce((a, r) => a + Number(r.valor || 0), 0);

  const expensesInPeriod = useMemo(() =>
    expenses.filter((x) => {
      const d = x.pago_em ? x.pago_em.slice(0, 10) : x.data_vencimento;
      if (!d) return false;
      return d >= fromIso && d <= toIso;
    }), [expenses, fromIso, toIso]);
  const totalExpenses = expensesInPeriod.filter((x) => x.status !== "cancelado")
    .reduce((a, x) => a + Number(x.valor_pago ?? x.valor ?? 0), 0);

  const commissionsInPeriod = useMemo(() =>
    commissions.filter((c) => {
      const ini = c.closing?.semana_inicio;
      if (!ini) return false;
      return ini >= fromIso && ini <= toIso;
    }), [commissions, fromIso, toIso]);
  const totalCommission = commissionsInPeriod.reduce((a, c) => a + Number(c.saldo_produtora || 0), 0);

  const result = totalRevenues - totalExpenses + totalCommission;

  // Lista unificada
  const movements = useMemo(() => {
    const list: any[] = [];
    for (const r of revenues) {
      list.push({
        date: r.data_recebimento, type: r.tipo, kind: "revenue",
        descricao: r.descricao, artist_id: r.artist_id,
        entrada: Number(r.valor || 0), saida: 0,
      });
    }
    for (const x of expensesInPeriod) {
      if (x.status === "cancelado") continue;
      list.push({
        date: x.pago_em ? x.pago_em.slice(0, 10) : x.data_vencimento,
        type: x.categoria, kind: "expense",
        descricao: x.descricao, artist_id: null,
        entrada: 0, saida: Number(x.valor_pago ?? x.valor ?? 0),
      });
    }
    for (const c of commissionsInPeriod) {
      if (Number(c.saldo_produtora) <= 0) continue;
      list.push({
        date: c.closing?.semana_inicio ?? c.created_at?.slice(0, 10),
        type: "comissao_produtora", kind: "commission",
        descricao: `Comissão produtora — ${c.vendedor_nome ?? "—"}`,
        artist_id: c.artist_id,
        entrada: Number(c.saldo_produtora || 0), saida: 0,
      });
    }
    list.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
    let saldo = 0;
    return list.map((m) => {
      saldo += m.entrada - m.saida;
      return { ...m, saldo };
    });
  }, [revenues, expensesInPeriod, commissionsInPeriod]);

  const artistName = (id: string | null) => id ? (artists.find((a) => a.id === id)?.nome ?? "—") : "—";

  // ===== Despesas =====
  const today = new Date().toISOString().slice(0, 10);
  const in5days = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
  const dueSoon = expenses.filter((x) => x.status === "pendente" && x.data_vencimento && x.data_vencimento >= today && x.data_vencimento <= in5days);
  const overdue = expenses.filter((x) => x.status === "pendente" && x.data_vencimento && x.data_vencimento < today);

  const currentMonth = monthRefOf(new Date());
  const [expMonth, setExpMonth] = useState(currentMonth);
  const monthExpenses = expenses.filter((x) => x.mes_referencia === expMonth);

  // Filtragem receitas
  const filteredRevenues = revenues.filter((r) => {
    if (filterArtist !== "all" && r.artist_id !== (filterArtist === "none" ? null : filterArtist)) return false;
    if (filterRevType !== "all" && r.tipo !== filterRevType) return false;
    return true;
  });

  // Filtragem comissão
  const filteredCommissions = commissionsInPeriod.filter((c) =>
    commArtist === "all" || c.artist_id === commArtist
  );
  const totalCommissionFiltered = filteredCommissions.reduce((a, c) => a + Number(c.saldo_produtora || 0), 0);

  // Gerar despesas recorrentes do mês atual
  const generateRecurringForMonth = async () => {
    if (!canManage) return;
    const ref = expMonth;
    const [yy, mm] = ref.split("-").map(Number);
    const activeRec = recurring.filter((r) => r.ativo);
    let created = 0;
    for (const rec of activeRec) {
      const existing = expenses.find((e) => e.recurring_id === rec.id && e.mes_referencia === ref);
      if (existing) continue;
      const day = Math.min(rec.dia_vencimento, new Date(yy, mm, 0).getDate());
      const dataVenc = `${yy}-${String(mm).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const { error } = await supabase.from("producer_expenses" as any).insert({
        categoria: rec.categoria, descricao: rec.descricao,
        beneficiario: rec.beneficiario, valor: rec.valor,
        recorrente: true, recurring_id: rec.id,
        dia_vencimento: rec.dia_vencimento, data_vencimento: dataVenc,
        status: "pendente", forma_pagamento: rec.forma_pagamento_padrao,
        mes_referencia: ref, observacoes: rec.observacoes,
      });
      if (!error) created++;
    }
    if (created > 0) toast.success(`${created} despesa(s) gerada(s) para ${ref}`);
    else toast.info("Nenhuma nova despesa a gerar");
    load();
  };

  const cancelExpense = async (id: string) => {
    const motivo = prompt("Motivo do cancelamento:");
    if (!motivo) return;
    const { error } = await supabase.from("producer_expenses" as any)
      .update({ status: "cancelado", cancelado_motivo: motivo }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Despesa cancelada");
    load();
  };

  const deleteExpense = async (x: any) => {
    if (x.parcela_grupo_id) {
      const total = expenses.filter((e) => e.parcela_grupo_id === x.parcela_grupo_id).length;
      const all = confirm(
        `Esta despesa faz parte de um parcelamento (${total} parcelas).\n\n` +
        `OK = excluir TODAS as ${total} parcelas\nCancelar = manter`
      );
      if (!all) return;
      const { error } = await supabase.from("producer_expenses" as any)
        .delete().eq("parcela_grupo_id", x.parcela_grupo_id);
      if (error) return toast.error(error.message);
      toast.success(`${total} parcelas excluídas`);
    } else {
      if (!confirm("Excluir esta despesa?")) return;
      const { error } = await supabase.from("producer_expenses" as any).delete().eq("id", x.id);
      if (error) return toast.error(error.message);
      toast.success("Despesa excluída");
    }
    load();
  };

  const deleteRevenue = async (id: string) => {
    if (!confirm("Excluir esta receita?")) return;
    const { error } = await supabase.from("producer_revenues" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Receita excluída");
    load();
  };

  const deleteRecurring = async (id: string) => {
    if (!confirm("Excluir este modelo recorrente? Despesas já geradas continuam.")) return;
    const { error } = await supabase.from("producer_recurring_expenses" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Excluído");
    load();
  };

  const toggleRecurring = async (r: Recurring) => {
    await supabase.from("producer_recurring_expenses" as any).update({ ativo: !r.ativo }).eq("id", r.id);
    load();
  };

  const statusBadge = (s: string) => {
    if (s === "pago") return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Pago</Badge>;
    if (s === "cancelado") return <Badge variant="destructive">Cancelado</Badge>;
    return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Pendente</Badge>;
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1400px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Financeiro da Produtora</h1>
          <p className="text-sm text-muted-foreground">Receitas, despesas e comissões da empresa</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodPreset)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Este mês</SelectItem>
              <SelectItem value="3months">Últimos 3 meses</SelectItem>
              <SelectItem value="year">Este ano</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
          {period === "custom" && (
            <>
              <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-40" />
              <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-40" />
            </>
          )}
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="revenues">Receitas</TabsTrigger>
          <TabsTrigger value="expenses">Despesas</TabsTrigger>
          <TabsTrigger value="commission">Comissão produtora</TabsTrigger>
        </TabsList>

        {/* ===== Aba 1 — Visão geral ===== */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Receitas do período</CardTitle>
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600">{fmtBRL(totalRevenues)}</div>
                <p className="text-xs text-muted-foreground">{revenues.length} lançamentos</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Despesas do período</CardTitle>
                  <TrendingDown className="h-4 w-4 text-red-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{fmtBRL(totalExpenses)}</div>
                <p className="text-xs text-muted-foreground">{expensesInPeriod.length} despesas</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Saldo de comissão</CardTitle>
                  <Briefcase className="h-4 w-4 text-blue-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{fmtBRL(totalCommission)}</div>
                <p className="text-xs text-muted-foreground">Diferença bruta vs líquida</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Resultado do período</CardTitle>
                  <Wallet className={`h-4 w-4 ${result >= 0 ? "text-emerald-500" : "text-red-500"}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${result >= 0 ? "text-emerald-600" : "text-red-600"}`}>{fmtBRL(result)}</div>
                <p className="text-xs text-muted-foreground">Receitas − Despesas + Comissão</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Movimentações</CardTitle></CardHeader>
            <CardContent>
              {movements.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Sem movimentações no período</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground border-b">
                      <tr>
                        <th className="text-left py-2 px-2">Data</th>
                        <th className="text-left py-2 px-2">Tipo</th>
                        <th className="text-left py-2 px-2">Descrição</th>
                        <th className="text-left py-2 px-2">Artista</th>
                        <th className="text-right py-2 px-2">Entrada</th>
                        <th className="text-right py-2 px-2">Saída</th>
                        <th className="text-right py-2 px-2">Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movements.map((m, i) => {
                        const meta = m.kind === "revenue" ? revenueMeta(m.type)
                          : m.kind === "expense" ? expenseMeta(m.type)
                          : { label: "Comissão produtora", icon: "💼" };
                        return (
                          <tr key={i} className="border-b hover:bg-muted/40">
                            <td className="py-1.5 px-2">{fmtDate(m.date)}</td>
                            <td className="py-1.5 px-2">
                              <Badge variant="outline" className="text-xs">{(meta as any).icon} {(meta as any).label}</Badge>
                            </td>
                            <td className="py-1.5 px-2">{m.descricao}</td>
                            <td className="py-1.5 px-2 text-muted-foreground">{artistName(m.artist_id)}</td>
                            <td className="py-1.5 px-2 text-right text-emerald-600 font-medium">{m.entrada > 0 ? fmtBRL(m.entrada) : "—"}</td>
                            <td className="py-1.5 px-2 text-right text-red-600 font-medium">{m.saida > 0 ? fmtBRL(m.saida) : "—"}</td>
                            <td className={`py-1.5 px-2 text-right font-semibold ${m.saldo >= 0 ? "text-emerald-600" : "text-red-600"}`}>{fmtBRL(m.saldo)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== Aba 2 — Receitas ===== */}
        <TabsContent value="revenues" className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-end gap-3 justify-between">
            <div className="flex flex-wrap gap-3">
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select value={filterRevType} onValueChange={setFilterRevType}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {REVENUE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Artista</Label>
                <Select value={filterArtist} onValueChange={setFilterArtist}>
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="none">— Sem artista —</SelectItem>
                    {artists.map((a) => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {canManage && (
              <Button onClick={() => { setEditRev(null); setRevOpen(true); }}>
                <Plus className="h-4 w-4 mr-1" /> Nova receita
              </Button>
            )}
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground border-b">
                    <tr>
                      <th className="text-left py-2 px-3">Data</th>
                      <th className="text-left py-2 px-3">Tipo</th>
                      <th className="text-left py-2 px-3">Descrição</th>
                      <th className="text-left py-2 px-3">Artista</th>
                      <th className="text-left py-2 px-3">Distribuidora</th>
                      <th className="text-left py-2 px-3">Período</th>
                      <th className="text-right py-2 px-3">Valor</th>
                      {canManage && <th className="py-2 px-3"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRevenues.length === 0 && (
                      <tr><td colSpan={8} className="py-6 text-center text-muted-foreground">Sem receitas no período</td></tr>
                    )}
                    {filteredRevenues.map((r) => {
                      const m = revenueMeta(r.tipo);
                      return (
                        <tr key={r.id} className="border-b hover:bg-muted/40">
                          <td className="py-1.5 px-3">{fmtDate(r.data_recebimento)}</td>
                          <td className="py-1.5 px-3"><Badge variant="outline" className="text-xs">{m.icon} {m.label}</Badge></td>
                          <td className="py-1.5 px-3">{r.descricao}</td>
                          <td className="py-1.5 px-3 text-muted-foreground">{artistName(r.artist_id)}</td>
                          <td className="py-1.5 px-3">{r.distribuidora ?? "—"}</td>
                          <td className="py-1.5 px-3">{r.periodo_referencia ?? "—"}</td>
                          <td className="py-1.5 px-3 text-right text-emerald-600 font-medium">{fmtBRL(r.valor)}</td>
                          {canManage && (
                            <td className="py-1.5 px-3 text-right">
                              <div className="flex gap-1 justify-end">
                                <Button size="icon" variant="ghost" onClick={() => { setEditRev(r); setRevOpen(true); }}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button size="icon" variant="ghost" onClick={() => deleteRevenue(r.id)}>
                                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                </Button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== Aba 3 — Despesas ===== */}
        <TabsContent value="expenses" className="space-y-4">
          {dueSoon.length > 0 && (
            <Alert className="border-amber-200 bg-amber-50">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                <strong>{dueSoon.length}</strong> despesa(s) vencendo nos próximos 5 dias —{" "}
                {fmtBRL(dueSoon.reduce((a, x) => a + Number(x.valor || 0), 0))}
              </AlertDescription>
            </Alert>
          )}
          {overdue.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>{overdue.length}</strong> despesa(s) vencida(s) —{" "}
                {fmtBRL(overdue.reduce((a, x) => a + Number(x.valor || 0), 0))}
              </AlertDescription>
            </Alert>
          )}

          {/* Recorrentes */}
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Despesas recorrentes</CardTitle>
              {canManage && (
                <Button size="sm" onClick={() => { setEditRec(null); setRecOpen(true); }}>
                  <Plus className="h-4 w-4 mr-1" /> Nova recorrente
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground border-b">
                    <tr>
                      <th className="text-left py-2 px-3">Categoria</th>
                      <th className="text-left py-2 px-3">Descrição</th>
                      <th className="text-left py-2 px-3">Beneficiário</th>
                      <th className="text-right py-2 px-3">Valor</th>
                      <th className="text-center py-2 px-3">Dia venc.</th>
                      <th className="text-center py-2 px-3">Ativo</th>
                      {canManage && <th className="py-2 px-3"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {recurring.length === 0 && (
                      <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">Nenhuma despesa recorrente</td></tr>
                    )}
                    {recurring.map((r) => {
                      const m = expenseMeta(r.categoria);
                      return (
                        <tr key={r.id} className="border-b hover:bg-muted/40">
                          <td className="py-1.5 px-3">{m.icon} {m.label}</td>
                          <td className="py-1.5 px-3">{r.descricao}</td>
                          <td className="py-1.5 px-3">{r.beneficiario ?? "—"}</td>
                          <td className="py-1.5 px-3 text-right">{fmtBRL(r.valor)}</td>
                          <td className="py-1.5 px-3 text-center">{r.dia_vencimento}</td>
                          <td className="py-1.5 px-3 text-center">
                            <Switch checked={r.ativo} onCheckedChange={() => canManage && toggleRecurring(r)} disabled={!canManage} />
                          </td>
                          {canManage && (
                            <td className="py-1.5 px-3 text-right">
                              <div className="flex gap-1 justify-end">
                                <Button size="icon" variant="ghost" onClick={() => { setEditRec(r); setRecOpen(true); }}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button size="icon" variant="ghost" onClick={() => deleteRecurring(r.id)}>
                                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                </Button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Despesas do mês */}
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 flex-wrap gap-2">
              <CardTitle className="text-base">Despesas do mês</CardTitle>
              <div className="flex items-center gap-2">
                <Input type="month" value={expMonth} onChange={(e) => setExpMonth(e.target.value)} className="w-40" />
                {canManage && (
                  <>
                    <Button size="sm" variant="outline" onClick={generateRecurringForMonth}>
                      Gerar recorrentes
                    </Button>
                    <Button size="sm" onClick={() => { setEditExp(null); setExpOpen(true); }}>
                      <Plus className="h-4 w-4 mr-1" /> Despesa avulsa
                    </Button>
                  </>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground border-b">
                    <tr>
                      <th className="text-left py-2 px-3">Vencimento</th>
                      <th className="text-left py-2 px-3">Categoria</th>
                      <th className="text-left py-2 px-3">Tipo</th>
                      <th className="text-left py-2 px-3">Descrição</th>
                      <th className="text-center py-2 px-3">Parcela</th>
                      <th className="text-right py-2 px-3">Valor</th>
                      <th className="text-center py-2 px-3">Status</th>
                      {canManage && <th className="py-2 px-3"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {monthExpenses.length === 0 && (
                      <tr><td colSpan={8} className="py-6 text-center text-muted-foreground">Sem despesas neste mês</td></tr>
                    )}
                    {monthExpenses.map((x) => {
                      const catNew = getCategoria(x.categoria);
                      const catLegacy = expenseMeta(x.categoria);
                      const tipo = getTipoDespesa(x.tipo_despesa);
                      return (
                        <tr key={x.id} className="border-b hover:bg-muted/40">
                          <td className="py-1.5 px-3">{fmtDate(x.data_vencimento)}</td>
                          <td className="py-1.5 px-3">
                            {catNew ? (
                              <Badge variant="outline" className={`text-xs ${catNew.badgeClass}`}>
                                {catNew.icon} {catNew.label}
                              </Badge>
                            ) : (
                              <span>{catLegacy.icon} {catLegacy.label}</span>
                            )}
                          </td>
                          <td className="py-1.5 px-3">
                            <Badge variant="outline" className={`text-[10px] ${tipo.badgeClass}`}>{tipo.label}</Badge>
                          </td>
                          <td className="py-1.5 px-3">
                            {x.descricao}
                            {x.beneficiario && <span className="text-muted-foreground"> — {x.beneficiario}</span>}
                            {x.recorrente && <Badge variant="outline" className="ml-2 text-[10px]">recorrente</Badge>}
                          </td>
                          <td className="py-1.5 px-3 text-center text-xs text-muted-foreground">
                            {x.parcelado && x.numero_parcela ? `${x.numero_parcela}/${x.total_parcelas}` : "—"}
                          </td>
                          <td className="py-1.5 px-3 text-right">{fmtBRL(x.valor_pago ?? x.valor)}</td>
                          <td className="py-1.5 px-3 text-center">{statusBadge(x.status)}</td>
                          {canManage && (
                            <td className="py-1.5 px-3 text-right">
                              <div className="flex gap-1 justify-end">
                                {x.status === "pendente" && (
                                  <>
                                    <Button size="sm" variant="outline" onClick={() => { setPayExp(x); setPayOpen(true); }}>
                                      <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-emerald-600" />Pagar
                                    </Button>
                                    <Button size="icon" variant="ghost" onClick={() => { setEditExp(x); setExpOpen(true); }}>
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button size="icon" variant="ghost" onClick={() => cancelExpense(x.id)}>
                                      <XCircle className="h-3.5 w-3.5 text-red-500" />
                                    </Button>
                                  </>
                                )}
                                <Button size="icon" variant="ghost" onClick={() => deleteExpense(x)}>
                                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                </Button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== Aba 4 — Comissão ===== */}
        <TabsContent value="commission" className="space-y-4">
          <Alert>
            <AlertDescription className="text-xs">
              Quando o fechamento desconta 10% do cachê <strong>bruto</strong> mas o vendedor recebe 10% do <strong>líquido</strong>{" "}
              (cachê − equipe − van), a diferença fica para a produtora.
            </AlertDescription>
          </Alert>

          <div className="flex items-end gap-3">
            <div>
              <Label className="text-xs">Artista</Label>
              <Select value={commArtist} onValueChange={setCommArtist}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {artists.map((a) => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="ml-auto">
              <p className="text-xs text-muted-foreground">Total no período</p>
              <p className="text-2xl font-bold text-blue-600">{fmtBRL(totalCommissionFiltered)}</p>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground border-b">
                    <tr>
                      <th className="text-left py-2 px-3">Período</th>
                      <th className="text-left py-2 px-3">Artista</th>
                      <th className="text-left py-2 px-3">Vendedor</th>
                      <th className="text-right py-2 px-3">Comissão descontada</th>
                      <th className="text-right py-2 px-3">Vendedor recebe</th>
                      <th className="text-right py-2 px-3">Saldo produtora</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCommissions.length === 0 && (
                      <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">Sem comissões no período</td></tr>
                    )}
                    {filteredCommissions.map((c) => (
                      <tr key={c.id} className="border-b hover:bg-muted/40">
                        <td className="py-1.5 px-3">
                          {c.closing?.semana_inicio ? fmtDate(c.closing.semana_inicio) : "—"}
                          {c.closing?.semana_fim && <> — {fmtDate(c.closing.semana_fim)}</>}
                        </td>
                        <td className="py-1.5 px-3">{artistName(c.artist_id)}</td>
                        <td className="py-1.5 px-3">{c.vendedor_nome ?? "—"}</td>
                        <td className="py-1.5 px-3 text-right">{fmtBRL(c.comissao_descontada)}</td>
                        <td className="py-1.5 px-3 text-right">{fmtBRL(c.comissao_vendedor)}</td>
                        <td className="py-1.5 px-3 text-right text-blue-600 font-semibold">{fmtBRL(c.saldo_produtora)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <RevenueDialog open={revOpen} onOpenChange={setRevOpen} revenue={editRev} artists={artists} onDone={load} />
      <ExpenseDialog open={expOpen} onOpenChange={setExpOpen} expense={editExp} onDone={load} />
      <RecurringExpenseDialog open={recOpen} onOpenChange={setRecOpen} recurring={editRec} onDone={load} />
      <MarkExpensePaidDialog open={payOpen} onOpenChange={setPayOpen} expense={payExp} onDone={load} />
    </div>
  );
}
