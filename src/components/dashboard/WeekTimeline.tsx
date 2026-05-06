import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronRight } from "lucide-react";
import { format, addDays, parseISO, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { STATUS_CLASS, STATUS_LABEL } from "@/lib/showStatus";
import { fmtBRL, getWeekRange } from "@/lib/dashboard";

export interface TimelineShow {
  id: string;
  artist_id?: string | null;
  artist_nome?: string | null;
  data_show: string;
  horario?: string | null;
  local?: string | null;
  cidade?: string | null;
  cache_total?: number | null;
  status: string;
}

interface Props {
  shows: TimelineShow[];
  artists?: Array<{ id: string; nome: string }>;
  showArtistFilter?: boolean;
  onSelect?: (show: TimelineShow) => void;
  /** Para Vendedor: ids de shows próprios; demais aparecem com info reduzida */
  ownShowIds?: Set<string>;
}

const DAY_LABELS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

export function WeekTimeline({ shows, artists, showArtistFilter, onSelect, ownShowIds }: Props) {
  const [filterArtist, setFilterArtist] = useState<string>("all");
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const week = useMemo(() => getWeekRange(), []);
  const today = new Date().toISOString().slice(0, 10);

  const filtered = useMemo(
    () => shows.filter((s) => filterArtist === "all" || s.artist_id === filterArtist),
    [shows, filterArtist],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, TimelineShow[]>();
    const start = parseISO(week.start);
    for (let i = 0; i < 7; i++) {
      const d = addDays(start, i);
      const iso = d.toISOString().slice(0, 10);
      map.set(iso, []);
    }
    for (const s of filtered) {
      if (s.data_show >= week.start && s.data_show <= week.end) {
        map.get(s.data_show)?.push(s);
      }
    }
    return map;
  }, [filtered, week]);

  return (
    <Card className="p-5 shadow-soft">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">Shows desta semana</h2>
          <p className="text-xs text-muted-foreground capitalize">
            {format(parseISO(week.start), "dd 'de' MMM", { locale: ptBR })} — {format(parseISO(week.end), "dd 'de' MMM", { locale: ptBR })}
          </p>
        </div>
        {showArtistFilter && artists && artists.length > 0 && (
          <Select value={filterArtist} onValueChange={setFilterArtist}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Artista" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os artistas</SelectItem>
              {artists.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <ul className="divide-y">
        {Array.from(byDay.entries()).map(([iso, dayShows]) => {
          const d = parseISO(iso);
          const isToday = iso === today;
          const dayLabel = DAY_LABELS[d.getDay()];
          const dateLabel = format(d, "dd/MM");
          const expanded = expandedDay === iso;
          const showList = expanded || dayShows.length <= 1 ? dayShows : [];
          const collapsed = !expanded && dayShows.length > 1;

          return (
            <li
              key={iso}
              className={`py-3 flex gap-4 ${isToday ? "bg-green-500/5 -mx-2 px-2 rounded border-l-4 border-green-500" : ""}`}
            >
              <div className="w-16 shrink-0">
                <p className={`text-xs font-semibold ${isToday ? "text-green-600" : "text-muted-foreground"}`}>{dayLabel}</p>
                <p className={`text-sm ${isToday ? "font-bold text-green-700" : ""}`}>{dateLabel}</p>
                {isToday && <p className="text-[10px] text-green-600 font-semibold">HOJE</p>}
              </div>
              <div className="flex-1 min-w-0">
                {dayShows.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">Sem shows</p>
                ) : collapsed ? (
                  <button
                    type="button"
                    onClick={() => setExpandedDay(iso)}
                    className="text-sm text-accent hover:underline flex items-center gap-1"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                    {dayShows.length} shows neste dia
                  </button>
                ) : (
                  <ul className="space-y-2">
                    {showList.map((s) => {
                      const isOwn = !ownShowIds || ownShowIds.has(s.id);
                      return (
                        <li key={s.id}>
                          <button
                            type="button"
                            onClick={() => onSelect?.(s)}
                            className="w-full text-left rounded hover:bg-accent/5 p-1.5 -m-1.5 transition"
                          >
                            <div className="flex items-start justify-between gap-2 flex-wrap">
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-sm truncate">
                                  🎤 {s.artist_nome ?? "—"}
                                  {!isOwn && (
                                    <span className="ml-2 text-xs text-muted-foreground font-normal">
                                      (outro vendedor)
                                    </span>
                                  )}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {[s.local, s.cidade].filter(Boolean).join(" · ") || "—"}
                                  {s.horario ? ` · ${s.horario.slice(0, 5)}` : ""}
                                  {isOwn && s.cache_total ? ` · ${fmtBRL(Number(s.cache_total))}` : ""}
                                </p>
                              </div>
                              <Badge className={STATUS_CLASS[s.status as keyof typeof STATUS_CLASS] ?? ""}>
                                {STATUS_LABEL[s.status as keyof typeof STATUS_LABEL] ?? s.status}
                              </Badge>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                    {expanded && (
                      <button
                        type="button"
                        onClick={() => setExpandedDay(null)}
                        className="text-xs text-muted-foreground hover:underline flex items-center gap-1"
                      >
                        <ChevronDown className="h-3 w-3" /> Recolher
                      </button>
                    )}
                  </ul>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
