import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Filter, X, ChevronDown } from "lucide-react";
import { STATUS_CLASS, STATUS_LABEL } from "@/lib/showStatus";

export type PeriodoKey =
  | "todos"
  | "esta_semana"
  | "proxima_semana"
  | "este_mes"
  | "proximo_mes"
  | "personalizado";

export interface FiltersState {
  artista: string; // "" = todos
  periodo: PeriodoKey;
  status: string[]; // [] = todos
  customStart: string;
  customEnd: string;
}

export const defaultFilters: FiltersState = {
  artista: "",
  periodo: "todos",
  status: [],
  customStart: "",
  customEnd: "",
};

const STATUS_OPTIONS = [
  "pendente",
  "aprovada",
  "aguardando_pagamento",
  "confirmado",
  "cancelada",
];

const PERIODO_LABEL: Record<PeriodoKey, string> = {
  todos: "Todos",
  esta_semana: "Esta semana",
  proxima_semana: "Próxima semana",
  este_mes: "Este mês",
  proximo_mes: "Próximo mês",
  personalizado: "Personalizado",
};

function startOfWeekMon(d: Date) {
  const x = new Date(d);
  const dow = (x.getDay() + 6) % 7; // mon=0
  x.setDate(x.getDate() - dow);
  x.setHours(0, 0, 0, 0);
  return x;
}
function toISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function getPeriodRange(
  periodo: PeriodoKey,
  customStart: string,
  customEnd: string,
): { start: string; end: string } | null {
  const now = new Date();
  if (periodo === "todos") return null;
  if (periodo === "personalizado") {
    if (!customStart && !customEnd) return null;
    return { start: customStart || "0000-01-01", end: customEnd || "9999-12-31" };
  }
  if (periodo === "esta_semana") {
    const s = startOfWeekMon(now);
    const e = new Date(s);
    e.setDate(s.getDate() + 6);
    return { start: toISO(s), end: toISO(e) };
  }
  if (periodo === "proxima_semana") {
    const s = startOfWeekMon(now);
    s.setDate(s.getDate() + 7);
    const e = new Date(s);
    e.setDate(s.getDate() + 6);
    return { start: toISO(s), end: toISO(e) };
  }
  if (periodo === "este_mes") {
    const s = new Date(now.getFullYear(), now.getMonth(), 1);
    const e = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { start: toISO(s), end: toISO(e) };
  }
  if (periodo === "proximo_mes") {
    const s = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const e = new Date(now.getFullYear(), now.getMonth() + 2, 0);
    return { start: toISO(s), end: toISO(e) };
  }
  return null;
}

export function applyFilters<T extends { artist_id: string; data_show: string; status: string }>(
  rows: T[],
  f: FiltersState,
): T[] {
  const range = getPeriodRange(f.periodo, f.customStart, f.customEnd);
  return rows.filter((r) => {
    if (f.artista && r.artist_id !== f.artista) return false;
    if (f.status.length > 0 && !f.status.includes(r.status)) return false;
    if (range) {
      if (r.data_show < range.start || r.data_show > range.end) return false;
    }
    return true;
  });
}

export function countActive(f: FiltersState): number {
  let n = 0;
  if (f.artista) n++;
  if (f.periodo !== "todos") n++;
  if (f.status.length > 0) n++;
  return n;
}

interface Props {
  filters: FiltersState;
  onChange: (next: FiltersState) => void;
  artists: Array<{ id: string; nome: string; cor?: string | null }>;
  hideArtist?: boolean;
  total: number;
  filteredCount: number;
}

export function ShowsFilters({
  filters,
  onChange,
  artists,
  hideArtist,
  total,
  filteredCount,
}: Props) {
  const [open, setOpen] = useState(false);
  const active = countActive(filters);
  const sortedArtists = useMemo(
    () => [...artists].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [artists],
  );

  const clear = () => onChange(defaultFilters);

  const toggleStatus = (s: string) => {
    const has = filters.status.includes(s);
    onChange({
      ...filters,
      status: has ? filters.status.filter((x) => x !== s) : [...filters.status, s],
    });
  };

  const Controls = (
    <div className="flex flex-wrap items-end gap-3">
      {!hideArtist && (
        <div className="min-w-[180px] flex-1 sm:flex-none">
          <Label className="text-xs">Artista</Label>
          <Select
            value={filters.artista || "__all"}
            onValueChange={(v) => onChange({ ...filters, artista: v === "__all" ? "" : v })}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todos os artistas</SelectItem>
              {sortedArtists.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  <span className="inline-flex items-center gap-2">
                    {a.cor && (
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: a.cor }}
                      />
                    )}
                    {a.nome}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="min-w-[160px] flex-1 sm:flex-none">
        <Label className="text-xs">Período</Label>
        <Select
          value={filters.periodo}
          onValueChange={(v) => onChange({ ...filters, periodo: v as PeriodoKey })}
        >
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(PERIODO_LABEL) as PeriodoKey[]).map((k) => (
              <SelectItem key={k} value={k}>
                {PERIODO_LABEL[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filters.periodo === "personalizado" && (
        <>
          <div>
            <Label className="text-xs">De</Label>
            <Input
              type="date"
              className="h-9 w-[150px]"
              value={filters.customStart}
              onChange={(e) => onChange({ ...filters, customStart: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">Até</Label>
            <Input
              type="date"
              className="h-9 w-[150px]"
              value={filters.customEnd}
              onChange={(e) => onChange({ ...filters, customEnd: e.target.value })}
            />
          </div>
        </>
      )}

      <div className="min-w-[180px] flex-1 sm:flex-none">
        <Label className="text-xs">Status</Label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="h-9 w-full justify-between font-normal">
              <span className="truncate">
                {filters.status.length === 0
                  ? "Todos os status"
                  : filters.status.length === 1
                    ? (STATUS_LABEL as any)[filters.status[0]] ?? filters.status[0]
                    : `${filters.status.length} selecionados`}
              </span>
              <ChevronDown className="h-4 w-4 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="start">
            <DropdownMenuLabel>Filtrar por status</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {STATUS_OPTIONS.map((s) => (
              <DropdownMenuCheckboxItem
                key={s}
                checked={filters.status.includes(s)}
                onCheckedChange={() => toggleStatus(s)}
                onSelect={(e) => e.preventDefault()}
              >
                <Badge className={(STATUS_CLASS as any)[s] ?? ""}>
                  {(STATUS_LABEL as any)[s] ?? s}
                </Badge>
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {active > 0 && (
        <Button variant="ghost" size="sm" onClick={clear} className="h-9">
          <X className="h-4 w-4 mr-1" /> Limpar
        </Button>
      )}
    </div>
  );

  return (
    <div className="mb-4 space-y-2">
      {/* Desktop */}
      <div className="hidden md:block rounded-md border bg-card p-3">{Controls}</div>

      {/* Mobile */}
      <div className="md:hidden flex items-center justify-between gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Filter className="h-4 w-4" />
              Filtros
              {active > 0 && (
                <Badge className="ml-1 h-5 px-1.5">{active}</Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[92vw] max-w-md" align="start">
            {Controls}
          </PopoverContent>
        </Popover>
        <p className="text-xs text-muted-foreground">
          Exibindo {filteredCount} de {total}
        </p>
      </div>

      <p className="hidden md:block text-xs text-muted-foreground">
        Exibindo {filteredCount} de {total} shows
      </p>
    </div>
  );
}

export function filtersToParams(f: FiltersState): URLSearchParams {
  const p = new URLSearchParams();
  if (f.artista) p.set("artista", f.artista);
  if (f.periodo !== "todos") p.set("periodo", f.periodo);
  if (f.status.length) p.set("status", f.status.join(","));
  if (f.periodo === "personalizado") {
    if (f.customStart) p.set("de", f.customStart);
    if (f.customEnd) p.set("ate", f.customEnd);
  }
  return p;
}

export function filtersFromParams(p: URLSearchParams): FiltersState {
  const periodo = (p.get("periodo") as PeriodoKey) || "todos";
  return {
    artista: p.get("artista") || "",
    periodo: (
      ["todos", "esta_semana", "proxima_semana", "este_mes", "proximo_mes", "personalizado"] as PeriodoKey[]
    ).includes(periodo)
      ? periodo
      : "todos",
    status: (p.get("status") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    customStart: p.get("de") || "",
    customEnd: p.get("ate") || "",
  };
}
