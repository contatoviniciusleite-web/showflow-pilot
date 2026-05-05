import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { CompleteProfileBanner } from "@/components/CompleteProfileBanner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Wallet, Music2, CheckCircle2 } from "lucide-react";
import { StatCard } from "./StatCard";
import { PeriodFilter } from "./PeriodFilter";
import { Period, fmtBRL, fmtDate, getMonthRange, getWeekRange, getRangeFor, inRange, isApprovedStatus, sumCache, PERIOD_LABEL } from "@/lib/dashboard";
import { STATUS_CLASS, STATUS_LABEL, ShowStatus } from "@/lib/showStatus";

interface ShowLite {
  id: string;
  artist_nome?: string | null;
  data_show: string;
  status: ShowStatus;
  cache_total: number;
  local: string | null;
  cidade: string | null;
  horario: string | null;
}

export function ArtistaDashboard() {
  const { user } = useAuth();
  const { displayName } = useProfile();
  const [period, setPeriod] = useState<Period>("semana");
  const [shows, setShows] = useState<ShowLite[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = async () => {
    const r = await supabase.functions.invoke("shows-admin", { body: { action: "list" } });
    setShows((r.data?.shows ?? []) as ShowLite[]);
    setLoading(false);
  };

  useEffect(() => {
    refetch();
  }, []);
  useRealtimeInvalidate({
    channel: "artista-dash",
    tables: ["shows"],
    queryKeys: [],
    debounceMs: 400,
    onEvent: refetch,
  });

  const week = useMemo(() => getWeekRange(), []);
  const month = useMemo(() => getMonthRange(), []);
  const range = useMemo(() => getRangeFor(period), [period]);
  const today = new Date().toISOString().slice(0, 10);

  const semana = useMemo(
    () => shows.filter((s) => inRange(s.data_show, week.start, week.end)),
    [shows, week],
  );
  const periodo = useMemo(
    () => shows.filter((s) => inRange(s.data_show, range.start, range.end)),
    [shows, range],
  );
  const proximos = useMemo(
    () => shows
      .filter((s) => s.data_show >= today && s.status !== "cancelada")
      .sort((a, b) => a.data_show.localeCompare(b.data_show)),
    [shows, today],
  );
  const passados = useMemo(
    () => shows
      .filter((s) => s.data_show < today)
      .sort((a, b) => b.data_show.localeCompare(a.data_show)),
    [shows, today],
  );

  const fatSemana = sumCache(semana.filter((s) => isApprovedStatus(s.status)));
  const cacheRecebidoMes = sumCache(
    shows.filter((s) => inRange(s.data_show, month.start, month.end) && s.status === "confirmado"),
  );

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="mb-4">
        <CompleteProfileBanner />
      </div>
      <div className="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold">Olá, {displayName}</h1>
          <p className="text-muted-foreground mt-1">Sua agenda e financeiro pessoal.</p>
        </div>
        <PeriodFilter value={period} onChange={setPeriod} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Shows nesta semana" value={String(semana.length)} icon={CalendarDays} tone="blue" />
        <StatCard label="Faturamento da semana" value={fmtBRL(fatSemana)} icon={Wallet} tone="green" />
        <StatCard label="Recebido no mês" value={fmtBRL(cacheRecebidoMes)} icon={CheckCircle2} tone="green" />
        <StatCard label={`Shows (${PERIOD_LABEL[period].toLowerCase()})`} value={String(periodo.length)} icon={Music2} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-6 shadow-soft">
          <h2 className="text-lg font-semibold mb-4">Agenda — próximos shows</h2>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : proximos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum show futuro.</p>
          ) : (
            <ul className="divide-y">
              {proximos.slice(0, 10).map((s) => {
                const naSemana = inRange(s.data_show, week.start, week.end);
                return (
                  <li key={s.id} className={`py-3 flex items-center justify-between gap-3 ${naSemana ? "bg-accent/5 -mx-2 px-2 rounded" : ""}`}>
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {fmtDate(s.data_show)}{s.horario ? ` · ${s.horario.slice(0, 5)}` : ""}
                        {naSemana && <span className="ml-2 text-xs text-accent font-semibold">esta semana</span>}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {s.local ?? "Local —"}{s.cidade ? ` · ${s.cidade}` : ""}
                      </p>
                    </div>
                    <span className="text-sm font-medium shrink-0">{fmtBRL(Number(s.cache_total ?? 0))}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="p-6 shadow-soft">
          <h2 className="text-lg font-semibold mb-4">Status de pagamento</h2>
          {proximos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem shows futuros.</p>
          ) : (
            <ul className="divide-y">
              {proximos.slice(0, 10).map((s) => (
                <li key={s.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{fmtDate(s.data_show)}{s.cidade ? ` · ${s.cidade}` : ""}</p>
                    <p className="text-xs text-muted-foreground">{fmtBRL(Number(s.cache_total ?? 0))}</p>
                  </div>
                  <Badge className={STATUS_CLASS[s.status] ?? ""}>{STATUS_LABEL[s.status] ?? s.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="p-6 shadow-soft mt-6">
        <h2 className="text-lg font-semibold mb-4">Histórico de shows realizados</h2>
        {passados.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum show realizado ainda.</p>
        ) : (
          <ul className="divide-y">
            {passados.slice(0, 12).map((s) => (
              <li key={s.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">{fmtDate(s.data_show)}</p>
                  <p className="text-xs text-muted-foreground truncate">{s.local ?? "—"}{s.cidade ? ` · ${s.cidade}` : ""}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-medium">{fmtBRL(Number(s.cache_total ?? 0))}</span>
                  <Badge className={STATUS_CLASS[s.status] ?? ""}>{STATUS_LABEL[s.status] ?? s.status}</Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
