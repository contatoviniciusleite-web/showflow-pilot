import { lazy, Suspense, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { useProfile } from "@/hooks/useProfile";
import { CompleteProfileBanner } from "@/components/CompleteProfileBanner";
import { Wallet, FileText, AlertTriangle, CheckCircle2 } from "lucide-react";
import { StatCard } from "./StatCard";
import { DashboardHeader } from "./DashboardHeader";
import { WeekTimeline, type TimelineShow } from "./WeekTimeline";
import { PendingActions, type PendingItem } from "./PendingActions";
import { NextShowsList } from "./NextShowsList";
import { fmtBRL, getMonthRange, getWeekRange, inRange } from "@/lib/dashboard";

const ShowDetailsModal = lazy(() => import("@/components/shows/ShowDetailsModal").then(m => ({ default: m.ShowDetailsModal })));

interface ShowFull extends TimelineShow {
  created_at: string;
  prazo_comprovante_em: string | null;
  comprovante_enviado_em?: string | null;
  total_pago?: number | string | null;
}

export function FinanceiroDashboard() {
  const { displayName } = useProfile();
  const [active, setActive] = useState<any>(null);

  const week = useMemo(() => getWeekRange(), []);
  const month = useMemo(() => getMonthRange(), []);
  const today = new Date().toISOString().slice(0, 10);
  const in3 = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const in7 = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  const dataQuery = useQuery({
    queryKey: ["dash-fin-all"],
    queryFn: async () => {
      const [showsRes, ordersRes, expensesRes, closingsRes] = await Promise.all([
        supabase.functions.invoke("shows-admin", { body: { action: "list" } }),
        supabase
          .from("payment_orders")
          .select("id, valor, valor_pago, status, data_sugerida, data_pagamento, pago_em"),
        supabase
          .from("producer_expenses")
          .select("id, valor, status, data_vencimento"),
        supabase
          .from("weekly_closings")
          .select("id, status")
          .neq("status", "finalizado"),
      ]);
      return {
        shows: (showsRes.data?.shows ?? []) as ShowFull[],
        orders: ordersRes.data ?? [],
        expenses: expensesRes.data ?? [],
        closings: closingsRes.data ?? [],
      };
    },
  });

  const shows = dataQuery.data?.shows ?? [];
  const orders = dataQuery.data?.orders ?? [];
  const expenses = dataQuery.data?.expenses ?? [];
  const closings = dataQuery.data?.closings ?? [];

  useRealtimeInvalidate({
    channel: "dash-fin",
    tables: ["shows", "payment_orders", "producer_expenses", "weekly_closings"],
    queryKeys: [["dash-fin-all"]],
    debounceMs: 400,
  });

  const showsSemana = shows.filter((s) => inRange(s.data_show, week.start, week.end));
  // Card 1: A receber esta semana = SUM(cache_total - total_pago) WHERE status='confirmado'
  const aReceberSemana = showsSemana
    .filter((s) => s.status === "confirmado")
    .reduce((acc, s) => acc + (Number(s.cache_total ?? 0) - Number((s as any).total_pago ?? 0)), 0);

  // Card 2: ordens pendentes/agendadas
  const ordensPendentes = orders.filter((o: any) => o.status === "pendente" || o.status === "agendado");
  // Vencidas hoje (data_pagamento < hoje OU data_sugerida <= hoje, sem pagamento)
  const ordensVencidasHoje = ordensPendentes.filter(
    (o: any) => (o.data_pagamento && o.data_pagamento < today) || (o.data_sugerida && o.data_sugerida < today),
  );

  // Card 4: Total pago no mês — SUM(valor_pago) WHERE status='pago' AND pago_em no mês
  const totalPagoMes = orders
    .filter((o: any) => {
      if (o.status !== "pago") return false;
      const ref = (o.pago_em ? String(o.pago_em).slice(0, 10) : null) || o.data_pagamento;
      return ref && inRange(ref, month.start, month.end);
    })
    .reduce((acc: number, o: any) => acc + Number(o.valor_pago ?? o.valor ?? 0), 0);

  // Card 3: Despesas a vencer em 7 dias (pendente)
  const despesasProx7 = expenses.filter(
    (e: any) => e.status === "pendente" && e.data_vencimento && e.data_vencimento >= today && e.data_vencimento <= in7,
  );
  const despesasProx7Total = despesasProx7.reduce((a: number, e: any) => a + Number(e.valor ?? 0), 0);

  // Pending actions reais
  const despesasProx3 = expenses.filter(
    (e: any) => e.status === "pendente" && e.data_vencimento && e.data_vencimento >= today && e.data_vencimento <= in3,
  );
  const despesasVencidas = expenses.filter(
    (e: any) => e.status === "pendente" && e.data_vencimento && e.data_vencimento < today,
  );

  const comprovantesAguard = shows.filter((s) => s.status === "aguardando_pagamento" && (s as any).comprovante_enviado_em);
  const fechamentosAbertos = closings.length;
  const contratosPendAntigos = shows.filter(
    (s) => s.status === "pendente" && s.created_at && s.created_at.slice(0, 10) <= sevenDaysAgo,
  );

  const pending: PendingItem[] = [];
  if (ordensVencidasHoje.length > 0) pending.push({ id: "o-venc", tone: "red", label: `${ordensVencidasHoje.length} ordem(ns) de pagamento vencida(s)`, href: "/pagamentos" });
  if (comprovantesAguard.length > 0) pending.push({ id: "comp", tone: "red", label: `${comprovantesAguard.length} comprovante(s) aguardando confirmação`, href: "/financeiro" });
  if (despesasVencidas.length > 0) pending.push({ id: "desp-venc", tone: "red", label: `${despesasVencidas.length} despesa(s) da produtora vencida(s)`, href: "/financeiro-produtora" });
  if (despesasProx3.length > 0) pending.push({ id: "desp-3d", tone: "amber", label: `${despesasProx3.length} despesa(s) vencendo em 3 dias`, href: "/financeiro-produtora" });
  if (fechamentosAbertos > 0) pending.push({ id: "fec", tone: "amber", label: `${fechamentosAbertos} fechamento(s) não finalizado(s)`, href: "/fechamento" });
  if (contratosPendAntigos.length > 0) pending.push({ id: "ctr", tone: "blue", label: `${contratosPendAntigos.length} contrato(s) pendente(s) há +7 dias`, href: "/shows" });


  const artists = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of shows) if (s.artist_id && s.artist_nome) m.set(s.artist_id, s.artist_nome);
    return Array.from(m, ([id, nome]) => ({ id, nome }));
  }, [shows]);

  const proximos = shows
    .filter((s) => s.data_show > week.end && s.status !== "cancelada")
    .sort((a, b) => a.data_show.localeCompare(b.data_show));

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <CompleteProfileBanner />
      <DashboardHeader name={displayName} subtitle="Controle financeiro da produtora" roleLabel="Financeiro" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="A receber esta semana" value={fmtBRL(aReceberSemana)} icon={Wallet} tone="green" />
        <StatCard label="Ordens pendentes" value={String(ordensPendentes.length)} icon={FileText} tone="red" highlight={ordensPendentes.length > 0} />
        <StatCard label="Despesas a vencer (7d)" value={fmtBRL(despesasProx7Total)} icon={AlertTriangle} tone="amber" hint={`${despesasProx7.length} despesa(s)`} />
        <StatCard label="Total pago no mês" value={fmtBRL(totalPagoMes)} icon={CheckCircle2} tone="green" />
      </div>

      <div className="mb-6">
        <WeekTimeline shows={showsSemana} artists={artists} showArtistFilter onSelect={setActive} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PendingActions items={pending} />
        <NextShowsList shows={proximos} showCache />
      </div>

      <Suspense fallback={null}>
        {active && <ShowDetailsModal show={active} open={!!active} onClose={() => setActive(null)} onChanged={() => dataQuery.refetch()} />}
      </Suspense>
    </div>
  );
}
