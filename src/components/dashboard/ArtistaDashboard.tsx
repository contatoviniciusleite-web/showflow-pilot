import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { useProfile } from "@/hooks/useProfile";
import { CompleteProfileBanner } from "@/components/CompleteProfileBanner";
import { CalendarDays, MapPin, Wallet, Trophy } from "lucide-react";
import { StatCard } from "./StatCard";
import { DashboardHeader } from "./DashboardHeader";
import { WeekTimeline, type TimelineShow } from "./WeekTimeline";
import { PendingActions, type PendingItem } from "./PendingActions";
import { NextShowsList } from "./NextShowsList";
import { fmtBRL, fmtDate, getMonthRange, getWeekRange, getYearRange, inRange } from "@/lib/dashboard";

const ShowDetailsModal = lazy(() => import("@/components/shows/ShowDetailsModal").then(m => ({ default: m.ShowDetailsModal })));

interface ShowFull extends TimelineShow {
  ultima_remarcacao_em?: string | null;
  total_pago?: number | string | null;
}

export function ArtistaDashboard() {
  const { displayName } = useProfile();
  const [shows, setShows] = useState<ShowFull[]>([]);
  const [fechamentosDisp, setFechamentosDisp] = useState(0);
  const [active, setActive] = useState<any>(null);

  const refetch = async () => {
    const r = await supabase.functions.invoke("shows-admin", { body: { action: "list" } });
    setShows((r.data?.shows ?? []) as ShowFull[]);
    const { count } = await supabase
      .from("weekly_closings")
      .select("id", { count: "exact", head: true })
      .eq("status", "finalizado");
    setFechamentosDisp(count ?? 0);
  };
  useEffect(() => { refetch(); }, []);
  useRealtimeInvalidate({ channel: "dash-artista", tables: ["shows", "weekly_closings"], queryKeys: [], debounceMs: 400, onEvent: refetch });

  const week = useMemo(() => getWeekRange(), []);
  const month = useMemo(() => getMonthRange(), []);
  const year = useMemo(() => getYearRange(), []);
  const today = new Date().toISOString().slice(0, 10);

  const showsSemana = shows.filter(s => inRange(s.data_show, week.start, week.end));
  const proximo = shows
    .filter(s => s.data_show >= today && s.status !== "cancelada")
    .sort((a, b) => a.data_show.localeCompare(b.data_show))[0];
  const cacheReceberMes = shows
    .filter(s => inRange(s.data_show, month.start, month.end) && s.status === "confirmado")
    .reduce((acc, s) => acc + (Number(s.cache_total ?? 0) - Number(s.total_pago ?? 0)), 0);
  const realizadosAno = shows.filter(s => inRange(s.data_show, year.start, year.end) && s.data_show < today && s.status === "confirmado").length;

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const remarcadosRecentes = shows.filter(s => s.ultima_remarcacao_em && s.ultima_remarcacao_em > sevenDaysAgo);

  const pending: PendingItem[] = [];
  if (fechamentosDisp > 0) pending.push({ id: "fech", tone: "blue", label: `${fechamentosDisp} fechamento(s) disponível(is) para ver`, href: "/fechamento" });
  if (remarcadosRecentes.length > 0) pending.push({ id: "rem", tone: "blue", label: `${remarcadosRecentes.length} show(s) remarcado(s) recentemente`, href: "/shows" });

  const proximos = shows.filter(s => s.data_show > week.end && s.status !== "cancelada")
    .sort((a, b) => a.data_show.localeCompare(b.data_show));

  const proximoLabel = proximo
    ? `${proximo.local || "—"} · ${fmtDate(proximo.data_show)}`
    : "—";

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <CompleteProfileBanner />
      <DashboardHeader name={displayName} subtitle="Sua agenda e financeiro" roleLabel="Artista" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Shows esta semana" value={String(showsSemana.length)} icon={CalendarDays} tone="green" />
        <StatCard
          label="Próximo show"
          value={proximoLabel}
          icon={MapPin}
          tone="blue"
          hint={proximo ? proximo.cidade ?? undefined : "Sem shows futuros"}
        />
        <StatCard label="Cachê a receber (mês)" value={fmtBRL(cacheReceberMes)} icon={Wallet} tone="green" />
        <StatCard label="Shows realizados no ano" value={String(realizadosAno)} icon={Trophy} tone="orange" />
      </div>

      <div className="mb-6">
        <WeekTimeline shows={showsSemana} showArtistFilter={false} onSelect={setActive} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PendingActions items={pending} />
        <NextShowsList shows={proximos} showCache />
      </div>

      <Suspense fallback={null}>
        {active && <ShowDetailsModal show={active} open={!!active} onClose={() => setActive(null)} onChanged={refetch} />}
      </Suspense>
    </div>
  );
}
