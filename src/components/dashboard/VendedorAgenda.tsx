import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, MapPin, Clock, Users } from "lucide-react";
import { ptBR } from "date-fns/locale";
import { format } from "date-fns";
import { fmtBRL } from "@/lib/dashboard";
import { STATUS_CLASS, STATUS_LABEL, ShowStatus } from "@/lib/showStatus";
import { cn } from "@/lib/utils";

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

function ymd(d: Date) {
  return format(d, "yyyy-MM-dd");
}

// Normaliza valores de data vindos do backend (podem chegar como "YYYY-MM-DD"
// ou ISO timestamp "YYYY-MM-DDTHH:mm:ss.sssZ"). Sempre devolve "YYYY-MM-DD".
function toDateKey(v: string | null | undefined): string {
  if (!v) return "";
  return v.length >= 10 ? v.slice(0, 10) : v;
}

export function VendedorAgenda() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [artists, setArtists] = useState<Artist[]>([]);
  const [own, setOwn] = useState<OwnShow[]>([]);
  const [outras, setOutras] = useState<PublicShow[]>([]);
  const [filterArtist, setFilterArtist] = useState<string>("all");
  const [selected, setSelected] = useState<Date | undefined>(new Date());
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState<Date>(new Date());

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

  useEffect(() => {
    refetch();
    const ch = supabase
      .channel("vendedor-agenda")
      .on("postgres_changes", { event: "*", schema: "public", table: "shows" }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Combina shows próprios + sanitizados; filtra por artista selecionado
  const allByDay = useMemo(() => {
    const map = new Map<string, Array<{ kind: "own" | "other"; data: OwnShow | PublicShow }>>();
    const push = (date: string, item: { kind: "own" | "other"; data: OwnShow | PublicShow }) => {
      const list = map.get(date) ?? [];
      list.push(item);
      map.set(date, list);
    };
    const pass = (artistId: string) => filterArtist === "all" || filterArtist === artistId;
    for (const s of own) {
      if (s.status === "cancelada") continue;
      if (!pass(s.artist_id)) continue;
      push(toDateKey(s.data_show), { kind: "own", data: s });
    }
    for (const s of outras) {
      if (!pass(s.artist_id)) continue;
      push(toDateKey(s.data_show), { kind: "other", data: s });
    }
    return map;
  }, [own, outras, filterArtist]);

  const selectedKey = selected ? ymd(selected) : "";
  const itemsOfDay = selectedKey ? (allByDay.get(selectedKey) ?? []) : [];
  const dayCount = itemsOfDay.length;

  // Decide qual artista pré-selecionar ao criar nova minuta na data
  const newShowArtist =
    filterArtist !== "all"
      ? filterArtist
      : artists.length === 1
        ? artists[0].id
        : "";

  const startNewShow = () => {
    if (!selected) return;
    const params = new URLSearchParams({ new: "1", data: selectedKey });
    if (newShowArtist) params.set("artist", newShowArtist);
    navigate(`/shows?${params.toString()}`);
  };

  // Para realçar dias ocupados no calendário
  const occupiedDates = useMemo(() => {
    return Array.from(allByDay.keys()).map((d) => {
      const [y, m, dd] = d.split("-").map(Number);
      return new Date(y, m - 1, dd);
    });
  }, [allByDay]);

  // Para artista específico, calcular se a data atingiu o limite (somente conta shows desse artista)
  const dayCountForArtist = (artistId: string, dayKey: string) => {
    const items = allByDay.get(dayKey) ?? [];
    return items.filter((it) => it.data.artist_id === artistId).length;
  };
  const limitReached = newShowArtist
    ? dayCountForArtist(newShowArtist, selectedKey) >= MAX_PER_DAY
    : false;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[auto,1fr] gap-6">
      <Card className="p-4 shadow-soft">
        <div className="flex items-center justify-between mb-3 gap-2">
          <div className="text-sm font-medium">Filtrar artista</div>
          <Select value={filterArtist} onValueChange={setFilterArtist}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos liberados</SelectItem>
              {artists.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {artists.length === 0 ? (
          <p className="text-sm text-muted-foreground p-4">
            Você ainda não tem permissão para vender nenhum artista. Fale com a gerência.
          </p>
        ) : (
          <Calendar
            mode="single"
            selected={selected}
            onSelect={setSelected}
            month={month}
            onMonthChange={setMonth}
            locale={ptBR}
            weekStartsOn={1}
            modifiers={{ occupied: occupiedDates }}
            modifiersClassNames={{ occupied: "relative font-semibold text-foreground after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1.5 after:h-1.5 after:rounded-full after:bg-primary" }}
            className={cn("p-3 pointer-events-auto")}
          />
        )}
      </Card>

      <Card className="p-6 shadow-soft">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-semibold">
              {selected ? format(selected, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR }) : "Selecione uma data"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {dayCount === 0 ? "Nenhum show neste dia." : `${dayCount} show(s) neste dia.`}
            </p>
          </div>
          <Button
            onClick={startNewShow}
            disabled={!selected || artists.length === 0 || limitReached || (!newShowArtist && filterArtist === "all" && artists.length > 1)}
            title={
              limitReached
                ? "Data indisponível para este artista. Limite máximo de shows atingido."
                : !newShowArtist && artists.length > 1
                  ? "Selecione um artista no filtro para criar uma minuta"
                  : ""
            }
          >
            <Plus className="h-4 w-4 mr-2" /> Novo show
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : itemsOfDay.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Data livre. Você pode propor um novo show neste dia.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {itemsOfDay.map((it) => {
              if (it.kind === "own") {
                const s = it.data as OwnShow;
                return (
                  <li key={`own-${s.id}`} className="border rounded-md p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-full"
                          style={{ background: s.artist_cor ?? "hsl(var(--primary))" }}
                        />
                        <p className="font-medium truncate">{s.artist_nome ?? "—"}</p>
                        {s.created_by && user?.id && s.created_by === user.id ? (
                          <Badge variant="outline" className="text-[10px]">Minha minuta</Badge>
                        ) : s.vendedor ? (
                          <Badge variant="outline" className="text-[10px]"><Users className="h-3 w-3 mr-1" />{s.vendedor}</Badge>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1">
                        {s.horario && <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{s.horario.slice(0,5)}</span>}
                        {s.local && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{s.local}{s.cidade ? ` · ${s.cidade}` : ""}</span>}
                        <span>{fmtBRL(Number(s.cache_total ?? 0))}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={STATUS_CLASS[s.status] ?? ""}>{STATUS_LABEL[s.status] ?? s.status}</Badge>
                      <Button size="sm" variant="ghost" onClick={() => navigate("/shows")}>Abrir</Button>
                    </div>
                  </li>
                );
              }
              const s = it.data as PublicShow;
              return (
                <li key={`pub-${s.id}`} className="border rounded-md p-3 bg-muted/30">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full opacity-70"
                      style={{ background: s.artist_cor ?? "hsl(var(--primary))" }}
                    />
                    <p className="font-medium truncate">{s.artist_nome ?? "Show"}</p>
                    <Badge variant="outline" className="text-[10px]"><Users className="h-3 w-3 mr-1" />Outro vendedor</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1">
                    {s.horario && <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{s.horario.slice(0,5)}</span>}
                    {s.local && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{s.local}{s.cidade ? ` · ${s.cidade}` : ""}</span>}
                    {s.vendedor && <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />Vendedor: {s.vendedor}</span>}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
