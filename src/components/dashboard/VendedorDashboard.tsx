import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "react-router-dom";
import { CheckCircle2, Clock, FileText, Wallet, XCircle } from "lucide-react";
import { StatCard } from "./StatCard";
import { PeriodFilter } from "./PeriodFilter";
import { Period, fmtBRL, fmtDate, getRangeFor, inRange, isApprovedStatus, sumCache, PERIOD_LABEL } from "@/lib/dashboard";
import { STATUS_CLASS, STATUS_LABEL, ShowStatus } from "@/lib/showStatus";
import { VendedorAgenda } from "./VendedorAgenda";

interface ShowLite {
  id: string;
  artist_nome?: string | null;
  data_show: string;
  status: ShowStatus;
  cache_total: number;
  local: string | null;
  cidade: string | null;
  created_by?: string | null;
}
interface NotifLite {
  id: string;
  tipo: string;
  created_at: string;
}

export function VendedorDashboard() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<Period>("mes");
  const [shows, setShows] = useState<ShowLite[]>([]);
  const [notifs, setNotifs] = useState<NotifLite[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = async () => {
    const [s, n] = await Promise.all([
      supabase.functions.invoke("shows-admin", { body: { action: "list" } }),
      supabase.functions.invoke("notifications", { body: { action: "list" } }),
    ]);
    const all = (s.data?.shows ?? []) as ShowLite[];
    // somente minutas criadas pelo vendedor logado
    setShows(all.filter((x) => x.created_by === user?.id));
    setNotifs((n.data?.notifications ?? []) as NotifLite[]);
    setLoading(false);
  };

  useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);
  useRealtimeInvalidate({
    channel: "vendedor-dash",
    tables: ["shows"],
    queryKeys: [],
    debounceMs: 400,
    onEvent: refetch,
    enabled: !!user?.id,
  });

  const range = useMemo(() => getRangeFor(period), [period]);
  const showsPeriodo = useMemo(
    () => shows.filter((s) => inRange(s.data_show, range.start, range.end)),
    [shows, range],
  );

  const total = showsPeriodo.length;
  const pendentes = showsPeriodo.filter((s) => s.status === "pendente").length;
  const aprovadas = showsPeriodo.filter((s) => isApprovedStatus(s.status)).length;
  const canceladas = showsPeriodo.filter((s) => s.status === "cancelada").length;
  const rejeitadasPeriodo = notifs.filter((n) => {
    if (n.tipo !== "minuta_rejeitada") return false;
    const d = n.created_at.slice(0, 10);
    return d >= range.start && d <= range.end;
  }).length;
  const volume = sumCache(showsPeriodo.filter((s) => isApprovedStatus(s.status)));

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold">Olá{user?.email ? `, ${user.email.split("@")[0]}` : ""}</h1>
          <p className="text-muted-foreground mt-1">Suas minutas e a agenda dos artistas liberados.</p>
        </div>
      </div>

      <Tabs defaultValue="resumo" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          <TabsTrigger value="agenda">Agenda</TabsTrigger>
        </TabsList>

        <TabsContent value="resumo">
          <div className="mb-6 flex justify-end">
            <PeriodFilter value={period} onChange={setPeriod} />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label="Total de minutas" value={String(total)} icon={FileText} />
            <StatCard label="Pendentes" value={String(pendentes)} icon={Clock} tone="amber" />
            <StatCard label="Aprovadas" value={String(aprovadas)} icon={CheckCircle2} tone="green" />
            <StatCard label="Rejeitadas" value={String(rejeitadasPeriodo)} icon={XCircle} tone="red" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <StatCard label="Canceladas" value={String(canceladas)} icon={XCircle} tone="red" />
            <StatCard label="Volume financeiro (aprovadas)" value={fmtBRL(volume)} icon={Wallet} tone="green" />
          </div>

          <Card className="p-6 shadow-soft">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Minhas minutas — {PERIOD_LABEL[period].toLowerCase()}</h2>
              <Link to="/shows" className="text-sm text-accent hover:underline">Ver todas</Link>
            </div>
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : showsPeriodo.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma minuta neste período. <Link to="/shows" className="text-accent underline">Criar nova</Link>.
              </p>
            ) : (
              <ul className="divide-y">
                {showsPeriodo
                  .slice()
                  .sort((a, b) => b.data_show.localeCompare(a.data_show))
                  .map((s) => (
                    <li key={s.id} className="py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{s.artist_nome ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">
                          {fmtDate(s.data_show)}
                          {s.cidade ? ` · ${s.cidade}` : ""}
                          {" · "}{fmtBRL(Number(s.cache_total ?? 0))}
                        </p>
                      </div>
                      <Badge className={STATUS_CLASS[s.status] ?? ""}>{STATUS_LABEL[s.status] ?? s.status}</Badge>
                    </li>
                  ))}
              </ul>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="agenda">
          <VendedorAgenda />
        </TabsContent>
      </Tabs>
    </div>
  );
}
