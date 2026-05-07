import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Clock, DollarSign } from "lucide-react";
import { ptBR } from "date-fns/locale";
import { format, parseISO } from "date-fns";
import { STATUS_CLASS, STATUS_LABEL, ShowStatus } from "@/lib/showStatus";
import { MonthCalendar, type AgendaEvent } from "@/components/agenda/MonthCalendar";
import { StatusFilter } from "@/components/agenda/StatusFilter";

interface Artist {
  id: string;
  nome: string;
  cor: string | null;
}

interface SocioShow {
  id: string;
  artist_id: string;
  data_show: string;
  horario: string | null;
  local: string | null;
  cidade: string | null;
  cache_total: number;
  status: ShowStatus;
}

const BRL = (v: number) =>
  Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function SocioAgenda() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [artists, setArtists] = useState<Artist[]>([]);
  const [shows, setShows] = useState<SocioShow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterArtist, setFilterArtist] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [month, setMonth] = useState<Date>(new Date());
  const [openDay, setOpenDay] = useState<Date | null>(null);

  const refetch = async () => {
    setLoading(true);
    const { data: links } = await supabase
      .from("socio_artists")
      .select("artist_id")
      .eq("socio_id", user?.id ?? "");
    const artistIds = (links ?? []).map((l) => l.artist_id);
    if (artistIds.length === 0) {
      setArtists([]);
      setShows([]);
      setLoading(false);
      return;
    }
    const [{ data: as }, { data: ss }] = await Promise.all([
      supabase.from("artists").select("id, nome, cor").in("id", artistIds),
      supabase
        .from("shows")
        .select("id, artist_id, data_show, horario, local, cidade, cache_total, status")
        .in("artist_id", artistIds)
        .neq("status", "cancelada")
        .order("data_show", { ascending: true }),
    ]);
    setArtists((as ?? []) as Artist[]);
    setShows((ss ?? []) as SocioShow[]);
    setLoading(false);
  };

  useEffect(() => {
    if (user?.id) refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useRealtimeInvalidate({
    channel: "socio-agenda",
    tables: ["shows"],
    queryKeys: [],
    debounceMs: 400,
    onEvent: refetch,
    enabled: !!user?.id,
  });

  const filtered = useMemo(() => {
    return shows.filter((s) => {
      if (filterArtist !== "all" && s.artist_id !== filterArtist) return false;
      if (filterStatus !== "all" && s.status !== filterStatus) return false;
      return true;
    });
  }, [shows, filterArtist, filterStatus]);

  const events: AgendaEvent[] = useMemo(
    () =>
      filtered.map((s) => {
        const artist = artists.find((a) => a.id === s.artist_id);
        return {
          id: s.id,
          date: s.data_show,
          time: s.horario,
          label: artist?.nome ?? "Show",
          status: s.status,
          artistColor: artist?.cor ?? null,
        };
      }),
    [filtered, artists],
  );

  const dayItems = useMemo(() => {
    if (!openDay) return [];
    const k = format(openDay, "yyyy-MM-dd");
    return filtered.filter((s) => s.data_show?.startsWith(k));
  }, [filtered, openDay]);

  if (artists.length === 0 && !loading) {
    return (
      <Card className="p-6 text-sm text-muted-foreground">
        Você ainda não está vinculado a nenhum artista. Fale com a gerência.
      </Card>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Select value={filterArtist} onValueChange={setFilterArtist}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Artista" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {artists.length === 1 ? artists[0].nome : "Todos meus artistas"}
            </SelectItem>
            {artists.length > 1 &&
              artists.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>
              ))}
          </SelectContent>
        </Select>
        <StatusFilter
          value={filterStatus}
          onChange={setFilterStatus}
          exclude={["rejeitada", "atrasado", "outro"]}
        />
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
              {openDay ? format(openDay, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR }) : ""}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            {dayItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem shows neste dia.</p>
            ) : (
              dayItems.map((s) => {
                const artist = artists.find((a) => a.id === s.artist_id);
                return (
                  <div key={s.id} className="border rounded-md p-3 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-full"
                        style={{ background: artist?.cor ?? "hsl(var(--primary))" }}
                      />
                      <p className="font-medium truncate flex-1">🎤 {artist?.nome ?? "—"}</p>
                      <Badge className={STATUS_CLASS[s.status] ?? ""}>
                        {STATUS_LABEL[s.status] ?? s.status}
                      </Badge>
                    </div>
                    {(s.local || s.cidade) && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {s.local ?? ""}{s.local && s.cidade ? " — " : ""}{s.cidade ?? ""}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(parseISO(s.data_show), "dd/MM/yyyy")}
                      {s.horario ? ` às ${s.horario.slice(0, 5)}` : ""}
                    </p>
                    <p className="text-sm font-semibold flex items-center gap-1">
                      <DollarSign className="h-4 w-4" />
                      {BRL(Number(s.cache_total ?? 0))}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
