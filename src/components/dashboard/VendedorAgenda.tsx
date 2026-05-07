import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, MapPin, Clock, Users } from "lucide-react";
import { ptBR } from "date-fns/locale";
import { format } from "date-fns";
import { STATUS_CLASS, STATUS_LABEL, ShowStatus } from "@/lib/showStatus";
import { MonthCalendar, type AgendaEvent } from "@/components/agenda/MonthCalendar";
import { StatusFilter } from "@/components/agenda/StatusFilter";

interface Artist {
  id: string;
  nome: string;
  cor?: string;
  cache_minimo?: number;
}
interface OwnShow {
  id: string;
  artist_id: string;
  artist_nome?: string | null;
  artist_cor?: string | null;
  data_show: string;
  horario: string | null;
  local: string | null;
  cidade: string | null;
  cache_total: number;
  status: ShowStatus;
  created_by?: string | null;
  vendedor?: string | null;
}
interface PublicShow {
  id: string;
  artist_id: string;
  artist_nome?: string | null;
  artist_cor?: string | null;
  data_show: string;
  horario: string | null;
  local: string | null;
  cidade: string | null;
  vendedor: string | null;
  status: ShowStatus;
}

const MAX_PER_DAY = 3;

export function VendedorAgenda() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [artists, setArtists] = useState<Artist[]>([]);
  const [own, setOwn] = useState<OwnShow[]>([]);
  const [outras, setOutras] = useState<PublicShow[]>([]);
  const [filterArtist, setFilterArtist] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [month, setMonth] = useState<Date>(new Date());
  const [openDay, setOpenDay] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = async () => {
    const [s, a] = await Promise.all([
      supabase.functions.invoke("shows-admin", { body: { action: "list" } }),
      supabase.functions.invoke("shows-admin", { body: { action: "artists" } }),
    ]);
    setOwn((s.data?.shows ?? []) as OwnShow[]);
    setOutras((s.data?.outras_aprovadas ?? []) as PublicShow[]);
    setArtists((a.data?.artists ?? []) as Artist[]);
    setLoading(false);
  };

  useEffect(() => { refetch(); /* eslint-disable-next-line */ }, [user?.id]);
  useRealtimeInvalidate({
    channel: "vendedor-agenda",
    tables: ["shows"],
    queryKeys: [],
    debounceMs: 400,
    onEvent: refetch,
    enabled: !!user?.id,
  });

  const allItems = useMemo(() => {
    const items: Array<{ kind: "own" | "other"; data: OwnShow | PublicShow }> = [];
    const pass = (artistId: string) => filterArtist === "all" || filterArtist === artistId;
    for (const s of own) {
      if (s.status === "cancelada") continue;
      if (!pass(s.artist_id)) continue;
      if (filterStatus !== "all" && filterStatus !== s.status) continue;
      items.push({ kind: "own", data: s });
    }
    for (const s of outras) {
      if (!pass(s.artist_id)) continue;
      if (filterStatus !== "all" && filterStatus !== s.status) continue;
      items.push({ kind: "other", data: s });
    }
    return items;
  }, [own, outras, filterArtist, filterStatus]);

  const events: AgendaEvent[] = useMemo(
    () =>
      allItems.map((it) => {
        const s = it.data;
        return {
          id: `${it.kind}-${s.id}`,
          date: s.data_show,
          time: s.horario,
          label: s.artist_nome ?? "Show",
          status: s.status,
          artistColor: s.artist_cor,
          onClick: () => {
            if (it.kind === "own") navigate("/shows");
            else setOpenDay(new Date(`${s.data_show}T00:00:00`));
          },
        };
      }),
    [allItems, navigate],
  );

  const dayItems = useMemo(() => {
    if (!openDay) return [];
    const k = format(openDay, "yyyy-MM-dd");
    return allItems.filter((it) => it.data.data_show?.startsWith(k));
  }, [allItems, openDay]);

  const monthItems = useMemo(() => {
    const ym = format(month, "yyyy-MM");
    return allItems.filter((it) => it.data.data_show?.startsWith(ym));
  }, [allItems, month]);

  const stats = useMemo(() => {
    const own = monthItems.filter((it) => it.kind === "own");
    const conf = own.filter((it) => (it.data as OwnShow).status === "confirmado").length;
    const pend = own.filter((it) =>
      ["pendente", "aguardando_pagamento", "aprovada"].includes((it.data as OwnShow).status),
    ).length;
    return { total: monthItems.length, conf, pend };
  }, [monthItems]);

  const newShowArtist =
    filterArtist !== "all" ? filterArtist : artists.length === 1 ? artists[0].id : "";

  const startNewShow = (date: Date) => {
    const params = new URLSearchParams({ new: "1", data: format(date, "yyyy-MM-dd") });
    if (newShowArtist) params.set("artist", newShowArtist);
    navigate(`/shows?${params.toString()}`);
  };

  const limitReached = openDay && newShowArtist
    ? allItems.filter(
        (it) =>
          it.data.artist_id === newShowArtist &&
          it.data.data_show?.startsWith(format(openDay, "yyyy-MM-dd")),
      ).length >= MAX_PER_DAY
    : false;

  if (artists.length === 0 && !loading) {
    return (
      <Card className="p-6 text-sm text-muted-foreground">
        Você ainda não tem permissão para vender nenhum artista. Fale com a gerência.
      </Card>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Select value={filterArtist} onValueChange={setFilterArtist}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Artista" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos liberados</SelectItem>
            {artists.map((a) => (
              <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <StatusFilter
          value={filterStatus}
          onChange={setFilterStatus}
          exclude={["rejeitada", "atrasado"]}
        />
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Total no mês</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </Card>
        <Card className="p-3 border-green-600/30">
          <p className="text-xs text-muted-foreground">Confirmados</p>
          <p className="text-2xl font-bold text-green-600">{stats.conf}</p>
        </Card>
        <Card className="p-3 border-yellow-500/30">
          <p className="text-xs text-muted-foreground">Pendentes</p>
          <p className="text-2xl font-bold text-yellow-600">{stats.pend}</p>
        </Card>
      </div>

      <Card className="p-4 shadow-soft">
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <MonthCalendar
            month={month}
            onMonthChange={setMonth}
            events={events}
            onSelectDay={setOpenDay}
            isMobile={isMobile}
          />
        )}
      </Card>

      <Sheet open={!!openDay} onOpenChange={(o) => !o && setOpenDay(null)}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="capitalize">
              {openDay ? format(openDay, "EEEE, d 'de' MMMM", { locale: ptBR }) : ""}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            {dayItems.length === 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Data livre. Você pode propor um novo show.</p>
                <Button
                  size="sm"
                  onClick={() => openDay && startNewShow(openDay)}
                  disabled={!newShowArtist && artists.length > 1}
                >
                  <Plus className="h-4 w-4 mr-2" /> Criar minuta
                </Button>
              </div>
            ) : (
              <>
                {dayItems.map((it) => {
                  if (it.kind === "own") {
                    const s = it.data as OwnShow;
                    return (
                      <div key={`own-${s.id}`} className="border rounded-md p-3">
                        <div className="flex items-center gap-2">
                          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: s.artist_cor ?? "hsl(var(--primary))" }} />
                          <p className="font-medium truncate flex-1">{s.artist_nome ?? "—"}</p>
                          <Badge className={STATUS_CLASS[s.status] ?? ""}>{STATUS_LABEL[s.status] ?? s.status}</Badge>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                          {s.horario && <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{s.horario.slice(0, 5)}</span>}
                          {s.local && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{s.local}{s.cidade ? ` · ${s.cidade}` : ""}</span>}
                          <span>{Number(s.cache_total ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                        </div>
                        <div className="mt-2 flex justify-end">
                          <Button size="sm" variant="outline" onClick={() => navigate("/shows")}>Ver detalhes</Button>
                        </div>
                      </div>
                    );
                  }
                  const s = it.data as PublicShow;
                  return (
                    <div key={`pub-${s.id}`} className="border rounded-md p-3 bg-muted/30">
                      <div className="flex items-center gap-2">
                        <span className="inline-block w-2.5 h-2.5 rounded-full opacity-70" style={{ background: s.artist_cor ?? "hsl(var(--primary))" }} />
                        <p className="font-medium truncate flex-1">{s.artist_nome ?? "Show"}</p>
                        <Badge className={STATUS_CLASS[s.status] ?? ""}>{STATUS_LABEL[s.status] ?? s.status}</Badge>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                        {s.horario && <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{s.horario.slice(0, 5)}</span>}
                        {s.local && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{s.local}{s.cidade ? ` · ${s.cidade}` : ""}</span>}
                      </div>
                    </div>
                  );
                })}
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => openDay && startNewShow(openDay)}
                  disabled={limitReached || (!newShowArtist && artists.length > 1)}
                >
                  <Plus className="h-4 w-4 mr-2" /> Nova minuta neste dia
                </Button>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
