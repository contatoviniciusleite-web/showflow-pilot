import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { CompleteProfileBanner } from "@/components/CompleteProfileBanner";
import { CheckCircle2, Clock, Wallet, TrendingUp } from "lucide-react";
import { StatCard } from "./StatCard";
import { DashboardHeader } from "./DashboardHeader";
import { WeekTimeline, type TimelineShow } from "./WeekTimeline";
import { PendingActions, type PendingItem } from "./PendingActions";
import { NextShowsList } from "./NextShowsList";
import { fmtBRL, getMonthRange, getWeekRange, inRange, isApprovedStatus, sumCache } from "@/lib/dashboard";

const ShowDetailsModal = lazy(() => import("@/components/shows/ShowDetailsModal").then(m => ({ default: m.ShowDetailsModal })));

interface ShowFull extends TimelineShow {
  created_by?: string | null;
  contratante_link_expires_at?: string | null;
  contratante_link_preenchido?: boolean | null;
  dados_completos_em?: string | null;
  prazo_comprovante_em?: string | null;
  total_equipe?: number | null;
  total_van?: number | null;
}

export function VendedorDashboard() {
  const { user } = useAuth();
  const { displayName } = useProfile();
  const [allShows, setAllShows] = useState<ShowFull[]>([]);
  const [active, setActive] = useState<any>(null);

  const refetch = async () => {
    const r = await supabase.functions.invoke("shows-admin", { body: { action: "list" } });
    setAllShows((r.data?.shows ?? []) as ShowFull[]);
  };
  useEffect(() => { refetch(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user?.id]);
  useRealtimeInvalidate({ channel: "dash-vend", tables: ["shows"], queryKeys: [], debounceMs: 400, onEvent: refetch, enabled: !!user?.id });

  const ownIds = useMemo(() => new Set(allShows.filter(s => s.created_by === user?.id).map(s => s.id)), [allShows, user?.id]);
  const own = useMemo(() => allShows.filter(s => s.created_by === user?.id), [allShows, user?.id]);

  const week = useMemo(() => getWeekRange(), []);
  const month = useMemo(() => getMonthRange(), []);
  const now = Date.now();

  const ownMes = own.filter(s => inRange(s.data_show, month.start, month.end));
  const confirmadosMes = ownMes.filter(s => s.status === "confirmado").length;
  const pendentesMinhas = own.filter(s => s.status === "pendente").length;
  const volumeMes = sumCache(ownMes.filter(s => isApprovedStatus(s.status)));
  const liquidoMes = ownMes
    .filter(s => s.status === "confirmado")
    .reduce((acc, s) => acc + (Number(s.cache_total ?? 0) - Number(s.total_equipe ?? 0) - Number(s.total_van ?? 0)), 0);
  const comissao = liquidoMes * 0.10;

  const rejeitadas = own.filter(s => s.status === "rejeitada");
  const compVencido = own.filter(s => s.status === "aguardando_pagamento" && s.prazo_comprovante_em && new Date(s.prazo_comprovante_em).getTime() < now);
  const linksExpirados = own.filter(s =>
    s.contratante_link_expires_at && !s.contratante_link_preenchido
    && new Date(s.contratante_link_expires_at).getTime() < now
  );
  const semDados = own.filter(s => s.status === "aprovada" && !s.dados_completos_em);
  const confirmadosSemana = own.filter(s => inRange(s.data_show, week.start, week.end) && s.status === "confirmado");

  const pending: PendingItem[] = [];
  if (rejeitadas.length > 0) pending.push({ id: "rej", tone: "red", label: `${rejeitadas.length} minuta(s) rejeitada(s) aguardando correção`, href: "/shows" });
  if (compVencido.length > 0) pending.push({ id: "comp", tone: "red", label: `${compVencido.length} show(s) com prazo de comprovante vencido`, href: "/shows" });
  if (linksExpirados.length > 0) pending.push({ id: "lnk", tone: "amber", label: `${linksExpirados.length} link(s) do contratante expirado(s)`, href: "/shows" });
  if (semDados.length > 0) pending.push({ id: "dad", tone: "amber", label: `${semDados.length} minuta(s) aprovada(s) sem dados completos`, href: "/shows" });
  if (confirmadosSemana.length > 0) pending.push({ id: "conf", tone: "blue", label: `${confirmadosSemana.length} show(s) confirmado(s) esta semana`, href: "/shows" });

  const showsSemana = allShows.filter(s => inRange(s.data_show, week.start, week.end));
  const proximos = own.filter(s => s.data_show > week.end && s.status !== "cancelada")
    .sort((a, b) => a.data_show.localeCompare(b.data_show));

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <CompleteProfileBanner />
      <DashboardHeader name={displayName} subtitle="Suas vendas e shows" roleLabel="Vendedor" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Confirmados no mês" value={String(confirmadosMes)} icon={CheckCircle2} tone="green" />
        <StatCard
          label="Minutas pendentes"
          value={String(pendentesMinhas)}
          icon={Clock}
          tone={pendentesMinhas > 0 ? "red" : "amber"}
          highlight={pendentesMinhas > 0}
        />
        <StatCard label="Volume de vendas (mês)" value={fmtBRL(volumeMes)} icon={Wallet} tone="blue" />
        <StatCard label="Comissão estimada" value={fmtBRL(comissao)} icon={TrendingUp} tone="green" hint="10% do líquido" />
      </div>

      <div className="mb-6">
        <WeekTimeline shows={showsSemana} ownShowIds={ownIds} onSelect={setActive} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PendingActions items={pending} />
        <NextShowsList shows={proximos} showCache emptyMessage="Sem próximos shows. Crie uma nova minuta." />
      </div>

      <Suspense fallback={null}>
        {active && <ShowDetailsModal show={active} open={!!active} onClose={() => setActive(null)} onChanged={refetch} />}
      </Suspense>
    </div>
  );
}
