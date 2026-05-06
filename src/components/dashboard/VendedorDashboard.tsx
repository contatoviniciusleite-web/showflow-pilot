import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { CompleteProfileBanner } from "@/components/CompleteProfileBanner";
import { CheckCircle2, FileText, Wallet, TrendingUp } from "lucide-react";
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
  const today = new Date().toISOString().slice(0, 10);

  const ownMes = own.filter(s => inRange(s.data_show, month.start, month.end));
  const confirmadosMes = ownMes.filter(s => s.status === "confirmado").length;
  const pendentesMinhas = own.filter(s => s.status === "pendente").length;
  const volumeMes = sumCache(ownMes.filter(s => isApprovedStatus(s.status)));
  const comissao = volumeMes * 0.10;

  const rejeitadas = own.filter(s => s.status === "rejeitada");
  const aguardComp = own.filter(s => s.status === "aguardando_pagamento");
  const linksExpirados = own.filter(s =>
    s.contratante_link_expires_at && !s.contratante_link_preenchido
    && new Date(s.contratante_link_expires_at).getTime() < Date.now()
  );
  const semDados = own.filter(s => s.status === "aprovada" && !s.dados_completos_em);

  const pending: PendingItem[] = [];
  if (rejeitadas.length > 0) pending.push({ id: "rej", tone: "red", label: `${rejeitadas.length} minuta(s) rejeitada(s) aguardando correção`, href: "/shows" });
  if (aguardComp.length > 0) pending.push({ id: "comp", tone: "amber", label: `${aguardComp.length} show(s) aguardando comprovante`, href: "/shows" });
  if (linksExpirados.length > 0) pending.push({ id: "lnk", tone: "amber", label: `${linksExpirados.length} link(s) do contratante expirado(s)`, href: "/shows" });
  if (semDados.length > 0) pending.push({ id: "dad", tone: "blue", label: `${semDados.length} minuta(s) aprovada(s) sem dados completos`, href: "/shows" });

  // Timeline: own + outros vendedores (mesmos artistas) — passamos todos os shows da semana
  const showsSemana = allShows.filter(s => inRange(s.data_show, week.start, week.end));
  const proximos = own.filter(s => s.data_show > week.end && s.status !== "cancelada")
    .sort((a, b) => a.data_show.localeCompare(b.data_show));

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <CompleteProfileBanner />
      <DashboardHeader name={displayName} subtitle="Suas vendas e shows" roleLabel="Vendedor" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Confirmados no mês" value={String(confirmadosMes)} icon={CheckCircle2} tone="green" />
        <StatCard label="Minhas minutas pendentes" value={String(pendentesMinhas)} icon={FileText} tone="amber" />
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
