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
import { fmtBRL, getMonthRange, getWeekRange, inRange, sumCache } from "@/lib/dashboard";

const ShowDetailsModal = lazy(() => import("@/components/shows/ShowDetailsModal").then(m => ({ default: m.ShowDetailsModal })));

interface ShowFull extends TimelineShow {
  created_at: string;
  prazo_comprovante_em: string | null;
  comprovante_enviado_em?: string | null;
}

export function FinanceiroDashboard() {
  const { displayName } = useProfile();
  const [active, setActive] = useState<any>(null);

  const showsQuery = useQuery({
    queryKey: ["dash-fin-shows"],
    queryFn: async () => {
      const r = await supabase.functions.invoke("shows-admin", { body: { action: "list" } });
      return (r.data?.shows ?? []) as ShowFull[];
    },
  });
  const ordersQuery = useQuery({
    queryKey: ["dash-fin-orders"],
    queryFn: async () => {
      const { data } = await supabase
        .from("payment_orders")
        .select("id, valor, valor_pago, status, data_sugerida, data_pagamento");
      return data ?? [];
    },
  });
  const expensesQuery = useQuery({
    queryKey: ["dash-fin-expenses"],
    queryFn: async () => {
      const { data } = await supabase
        .from("producer_expenses")
        .select("id, valor, status, data_vencimento");
      return data ?? [];
    },
  });
  const closingsQuery = useQuery({
    queryKey: ["dash-fin-closings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("weekly_closings")
        .select("id, status")
        .neq("status", "finalizado");
      return data ?? [];
    },
  });

  const shows = showsQuery.data ?? [];
  const orders = ordersQuery.data ?? [];
  const expenses = expensesQuery.data ?? [];

  useRealtimeInvalidate({ channel: "dash-fin", tables: ["shows", "payment_orders"], queryKeys: [["dash-fin-shows"], ["dash-fin-orders"]], debounceMs: 400 });

  const week = useMemo(() => getWeekRange(), []);
  const month = useMemo(() => getMonthRange(), []);
  const today = new Date().toISOString().slice(0, 10);
  const in7 = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  const showsSemana = shows.filter((s) => inRange(s.data_show, week.start, week.end));
  const aReceberSemana = sumCache(showsSemana.filter((s) => s.status === "aguardando_pagamento" || s.status === "confirmado"));

  const ordensPendentes = orders.filter((o: any) => o.status === "pendente" || o.status === "agendado");
  const ordensVencidasHoje = ordensPendentes.filter((o: any) => o.data_sugerida && o.data_sugerida <= today);
  const totalPagoMes = orders
    .filter((o: any) => o.status === "pago" && o.data_pagamento && inRange(o.data_pagamento, month.start, month.end))
    .reduce((acc: number, o: any) => acc + Number(o.valor_pago ?? o.valor ?? 0), 0);

  const despesasProx7 = expenses.filter(
    (e: any) => e.status === "pendente" && e.data_vencimento && e.data_vencimento >= today && e.data_vencimento <= in7,
  );
  const despesasProx7Total = despesasProx7.reduce((a: number, e: any) => a + Number(e.valor ?? 0), 0);
  const despesasVencidas = expenses.filter(
    (e: any) => e.status === "pendente" && e.data_vencimento && e.data_vencimento < today,
  );

  const comprovantesAguard = shows.filter((s) => s.status === "aguardando_pagamento" && (s as any).comprovante_enviado_em);
  const fechamentosAbertos = (closingsQuery.data ?? []).length;

  const pending: PendingItem[] = [];
  if (ordensVencidasHoje.length > 0) pending.push({ id: "o-venc", tone: "red", label: `${ordensVencidasHoje.length} ordem(ns) de pagamento vencida(s)`, href: "/pagamentos" });
  if (comprovantesAguard.length > 0) pending.push({ id: "comp", tone: "amber", label: `${comprovantesAguard.length} comprovante(s) aguardando confirmação`, href: "/financeiro" });
  if (despesasVencidas.length > 0) pending.push({ id: "desp", tone: "red", label: `${despesasVencidas.length} despesa(s) da produtora vencida(s)`, href: "/financeiro-produtora" });
  if (fechamentosAbertos > 0) pending.push({ id: "fec", tone: "blue", label: `${fechamentosAbertos} fechamento(s) para finalizar`, href: "/fechamento" });
  const contratosPend = shows.filter((s) => s.status === "pendente").length;
  if (contratosPend > 0) pending.push({ id: "ctr", tone: "blue", label: `${contratosPend} contrato(s) pendente(s)`, href: "/shows" });

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
        {active && <ShowDetailsModal show={active} open={!!active} onClose={() => setActive(null)} onChanged={() => showsQuery.refetch()} />}
      </Suspense>
    </div>
  );
}
