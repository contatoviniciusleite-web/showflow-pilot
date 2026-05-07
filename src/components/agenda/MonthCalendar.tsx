import { useMemo } from "react";
import {
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type AgendaEvent = {
  id: string;
  date: string; // YYYY-MM-DD
  time?: string | null;
  label: string;
  status: string; // chave de cor
  artistColor?: string | null;
  onClick?: () => void;
};

export const STATUS_COLORS: Record<string, { bg: string; label: string }> = {
  pendente: { bg: "#6B7280", label: "Pendente" },
  aprovada: { bg: "#2563EB", label: "Aprovada" },
  aguardando_pagamento: { bg: "#D97706", label: "Aguardando pagamento" },
  confirmado: { bg: "#16A34A", label: "Confirmado" },
  cancelada: { bg: "#DC2626", label: "Cancelado" },
  rejeitada: { bg: "#DC2626", label: "Rejeitada" },
  atrasado: { bg: "#991B1B", label: "Atrasado" },
};

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

interface Props {
  month: Date;
  onMonthChange: (d: Date) => void;
  events: AgendaEvent[];
  onSelectDay: (date: Date) => void;
  isMobile?: boolean;
}

export function MonthCalendar({ month, onMonthChange, events, onSelectDay, isMobile }: Props) {
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    const out: Date[] = [];
    let cur = start;
    while (cur <= end) {
      out.push(cur);
      cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1);
    }
    return out;
  }, [month]);

  const byDay = useMemo(() => {
    const m = new Map<string, AgendaEvent[]>();
    for (const e of events) {
      const k = e.date.slice(0, 10);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(e);
    }
    return m;
  }, [events]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg md:text-xl font-semibold capitalize">
          {format(month, "MMMM 'de' yyyy", { locale: ptBR })}
        </h2>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => onMonthChange(addMonths(month, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => onMonthChange(new Date())}>
            Hoje
          </Button>
          <Button variant="outline" size="sm" onClick={() => onMonthChange(addMonths(month, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 text-xs text-muted-foreground font-medium">
        {WEEKDAYS.map((d) => (
          <div key={d} className="px-2 py-1 text-center">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px bg-border rounded-md overflow-hidden border animate-fade-in">
        {days.map((d) => {
          const key = format(d, "yyyy-MM-dd");
          const items = byDay.get(key) ?? [];
          const inMonth = isSameMonth(d, month);
          const isToday = isSameDay(d, today);
          const visible = items.slice(0, isMobile ? 0 : 2);
          const extra = items.length - visible.length;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDay(d)}
              className={cn(
                "bg-background text-left p-1.5 flex flex-col gap-1 transition-colors hover:bg-accent/40",
                "min-h-[120px] md:min-h-[120px]",
                isMobile && "min-h-[64px]",
                !inMonth && "bg-muted/40 text-muted-foreground/60",
                isToday && "ring-2 ring-inset ring-green-600",
              )}
            >
              <div className="flex items-center justify-between">
                <span className={cn("text-xs font-semibold", isToday && "text-green-700")}>
                  {format(d, "d")}
                </span>
                {isMobile && items.length > 0 && (
                  <div className="flex gap-0.5 flex-wrap justify-end">
                    {items.slice(0, 4).map((e) => (
                      <span
                        key={e.id}
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: STATUS_COLORS[e.status]?.bg ?? "#6B7280" }}
                      />
                    ))}
                  </div>
                )}
              </div>
              {!isMobile && (
                <div className="flex flex-col gap-1">
                  {visible.map((e) => (
                    <span
                      key={e.id}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        e.onClick?.();
                      }}
                      className="truncate text-[11px] leading-tight rounded px-1.5 py-0.5 text-white cursor-pointer hover:opacity-90"
                      style={{ background: STATUS_COLORS[e.status]?.bg ?? "#6B7280" }}
                      title={e.label}
                    >
                      🎤 {e.label}
                      {e.time ? ` · ${e.time.slice(0, 5)}` : ""}
                    </span>
                  ))}
                  {extra > 0 && (
                    <span className="text-[10px] text-muted-foreground px-1">+{extra} mais</span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-2">
        {Object.entries(STATUS_COLORS)
          .filter(([k]) => !["rejeitada"].includes(k))
          .map(([k, v]) => (
            <div key={k} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: v.bg }} />
              {v.label}
            </div>
          ))}
      </div>
    </div>
  );
}
