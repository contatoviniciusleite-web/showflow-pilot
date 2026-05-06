import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { useProfile } from "@/hooks/useProfile";
import { CompleteProfileBanner } from "@/components/CompleteProfileBanner";
import { CalendarDays, FileText, Wallet, CheckCircle2 } from "lucide-react";
import { StatCard } from "./StatCard";
import { DashboardHeader } from "./DashboardHeader";
import { WeekTimeline, type TimelineShow } from "./WeekTimeline";
import { PendingActions, type PendingItem } from "./PendingActions";
import { NextShowsList } from "./NextShowsList";
import {
  fmtBRL, getMonthRange, getWeekRange, inRange, isApprovedStatus, sumCache,
  DASHBOARD_THRESHOLDS,
} from "@/lib/dashboard";

const ShowDetailsModal = lazy(() => import("@/components/shows/ShowDetailsModal").then(m => ({ default: m.ShowDetailsModal })));

interface ShowFull extends TimelineShow {
  created_at: string;
  prazo_comprovante_em: string | null;
  comprovante_enviado_em?: string | null;
  cancelado_em?: string | null;
}

export function DiretorDashboard() {
  const { displayName } = useProfile();
  const [active, setActive] = useState<any>(null);

  const dashQuery = useQuery({
    queryKey: ["dashboard-diretor"],
    queryFn: async () => {
      const r = await supabase.functions.invoke("shows-admin", { body: { action: "list" } });
      return (r.data?.shows ?? []) as ShowFull[];
    },
  });
  const closingsQuery = useQuery({
    queryKey: ["dashboard-diretor-closings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("weekly_closings")
        .select("id, status")
        .neq("status", "finalizado");
      return data ?? [];
    },
  });
  const shows = dashQuery.data ?? [];

  useRealtimeInvalidate({ channel: "dash-diretor", tables: ["shows"], queryKeys: [["dashboard-diretor"]], debounceMs: 400 });

  const week = useMemo(() => getWeekRange(), []);
  const month = useMemo(() => getMonthRange(), []);
  const today = new Date().toISOString().slice(0, 10);
  const nowMs = Date.now();

  const showsSemana = shows.filter((s) => inRange(s.data_show, week.start, week.end));
  const showsMes = shows.filter((s) => inRange(s.data_show, month.start, month.end));
  const aguardandoAprov = shows.filter((s) => s.status === "pendente");
  const faturamentoMes = sumCache(showsMes.filter((s) => isApprovedStatus(s.status)));
  const confirmadosMes = showsMes.filter((s) => s.status === "confirmado").length;

  const pagAtrasado = shows.filter(
    (s) => s.status === "aguardando_pagamento" && s.prazo_comprovante_em && new Date(s.prazo_comprovante_em).getTime() < nowMs,
  );
  const limiteContrato = nowMs - DASHBOARD_THRESHOLDS.contratoPendenteDias * 24 * 3600 * 1000;
  const contratosVelhos = shows.filter(
    (s) => s.status === "pendente" && new Date(s.created_at).getTime() < limiteContrato,
  );
  const fechamentosAbertos = (closingsQuery.data ?? []).length;

  const pending: PendingItem[] = [];
  if (aguardandoAprov.length > 0) pending.push({ id: "aprov", tone: "red", label: `${aguardandoAprov.length} minuta(s) aguardando sua aprovação`, href: "/shows" });
  if (pagAtrasado.length > 0) pending.push({ id: "pag", tone: "red", label: `${pagAtrasado.length} show(s) com pagamento atrasado`, href: "/financeiro" });
  if (contratosVelhos.length > 0) pending.push({ id: "ctr", tone: "amber", label: `${contratosVelhos.length} contrato(s) pendentes há mais de ${DASHBOARD_THRESHOLDS.contratoPendenteDias} dias`, href: "/shows" });
  if (fechamentosAbertos > 0) pending.push({ id: "fec", tone: "blue", label: `${fechamentosAbertos} fechamento(s) não finalizados`, href: "/fechamento" });

  const artists = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of shows) {
      if (s.artist_id && s.artist_nome) m.set(s.artist_id, s.artist_nome);
    }
    return Array.from(m, ([id, nome]) => ({ id, nome }));
  }, [shows]);

  const proximos = shows
    .filter((s) => s.data_show > week.end && s.status !== "cancelada")
    .sort((a, b) => a.data_show.localeCompare(b.data_show));

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <CompleteProfileBanner />
      <DashboardHeader name={displayName} subtitle="Visão completa da produtora" roleLabel="Diretor" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Shows esta semana" value={String(showsSemana.length)} icon={CalendarDays} tone="blue" hint={`${confirmadosMes} confirmados no mês`} />
        <StatCard label="Aguardando aprovação" value={String(aguardandoAprov.length)} icon={FileText} tone="red" highlight={aguardandoAprov.length > 0} hint="Minutas" />
        <StatCard label="Faturamento do mês" value={fmtBRL(faturamentoMes)} icon={Wallet} tone="green" hint="Cachê dos shows aprovados" />
        <StatCard label="Confirmados no mês" value={String(confirmadosMes)} icon={CheckCircle2} tone="green" />
      </div>

      <div className="mb-6">
        <WeekTimeline shows={showsSemana} artists={artists} showArtistFilter onSelect={setActive} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PendingActions items={pending} />
        <NextShowsList shows={proximos} showCache />
      </div>

      <Suspense fallback={null}>
        {active && <ShowDetailsModal show={active} open={!!active} onClose={() => setActive(null)} onChanged={() => dashQuery.refetch()} />}
      </Suspense>
    </div>
  );
}
