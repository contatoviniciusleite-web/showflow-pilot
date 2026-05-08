import { useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { fmtBRL, fmtDate } from "@/lib/dashboard";
import { STATUS_CLASS, STATUS_LABEL, ShowStatus } from "@/lib/showStatus";
import { ExportMenu } from "@/components/ExportMenu";
import type { Column } from "@/lib/exporters";

export interface AlertShow {
  id: string;
  artist_id: string;
  artist_nome: string | null;
  data_show: string;
  status: ShowStatus;
  cache_total: number;
  local: string | null;
  cidade: string | null;
  vendedor: string | null;
  created_by: string | null;
  created_at: string;
  prazo_comprovante_em: string | null;
}

type ExtraColumn = "prazo" | "criado" | "cancelado_em";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  shows: AlertShow[];
  artists: { id: string; nome: string }[];
  /** coluna extra a destacar (prazo de comprovante, data de criação, etc.) */
  extraColumn?: ExtraColumn;
}

export function AlertDetailSheet({
  open, onOpenChange, title, description, shows, artists, extraColumn,
}: Props) {
  const [filterArtist, setFilterArtist] = useState<string>("all");
  const [filterVendedor, setFilterVendedor] = useState<string>("all");
  const [search, setSearch] = useState("");

  const vendedores = useMemo(() => {
    const set = new Set<string>();
    shows.forEach((s) => { if (s.vendedor) set.add(s.vendedor); });
    return Array.from(set).sort();
  }, [shows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return shows.filter((s) =>
      (filterArtist === "all" || s.artist_id === filterArtist) &&
      (filterVendedor === "all" || (s.vendedor ?? "") === filterVendedor) &&
      (q === "" || [s.artist_nome, s.local, s.cidade, s.vendedor]
        .filter(Boolean).some((v) => String(v).toLowerCase().includes(q)))
    );
  }, [shows, filterArtist, filterVendedor, search]);

  const total = filtered.reduce((acc, s) => acc + Number(s.cache_total ?? 0), 0);

  const extraHeader =
    extraColumn === "prazo" ? "Prazo comprovante" :
    extraColumn === "criado" ? "Criado em" :
    extraColumn === "cancelado_em" ? "Show em" : null;

  const extraValue = (s: AlertShow) => {
    if (extraColumn === "prazo") return s.prazo_comprovante_em ? new Date(s.prazo_comprovante_em).toLocaleString("pt-BR") : "—";
    if (extraColumn === "criado") return new Date(s.created_at).toLocaleDateString("pt-BR");
    if (extraColumn === "cancelado_em") return fmtDate(s.data_show);
    return "";
  };

  const exportColumns: Column[] = [
    { header: "Show (data)", key: (r: AlertShow) => fmtDate(r.data_show) },
    { header: "Artista", key: (r: AlertShow) => r.artist_nome ?? "—" },
    { header: "Cidade/Local", key: (r: AlertShow) => [r.cidade, r.local].filter(Boolean).join(" — ") || "—" },
    { header: "Vendedor", key: (r: AlertShow) => r.vendedor ?? "—" },
    { header: "Status", key: (r: AlertShow) => STATUS_LABEL[r.status] ?? r.status },
    { header: "Cachê", key: (r: AlertShow) => fmtBRL(Number(r.cache_total ?? 0)), align: "right" },
    ...(extraHeader ? [{ header: extraHeader, key: (r: AlertShow) => extraValue(r) } as Column] : []),
  ];

  const filename = `alerta-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${new Date().toISOString().slice(0, 10)}`;

  const buildMeta = () => ({
    title: `Alerta — ${title}`,
    subtitle: description,
    filters: [
      filterArtist !== "all" ? `Artista: ${artists.find((a) => a.id === filterArtist)?.nome ?? "—"}` : null,
      filterVendedor !== "all" ? `Vendedor: ${filterVendedor}` : null,
      search ? `Busca: "${search}"` : null,
    ].filter(Boolean) as string[],
    summary: [
      { label: "Total de shows", value: String(filtered.length) },
      { label: "Soma de cachês", value: fmtBRL(total) },
    ],
    filename,
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Select value={filterArtist} onValueChange={setFilterArtist}>
            <SelectTrigger><SelectValue placeholder="Artista" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os artistas</SelectItem>
              {artists.map((a) => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterVendedor} onValueChange={setFilterVendedor}>
            <SelectTrigger><SelectValue placeholder="Vendedor" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os vendedores</SelectItem>
              {vendedores.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <div className="flex items-center justify-between mt-4 mb-2 text-sm">
          <span className="text-muted-foreground">
            {filtered.length} show(s) · {fmtBRL(total)}
          </span>
          <ExportMenu
            onExportPDF={() => exportPDF(filtered, exportColumns, buildMeta())}
            onExportCSV={() => exportCSV(filtered, exportColumns, buildMeta())}
            disabled={filtered.length === 0}
          />
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Nenhum item para mostrar.</p>
        ) : (
          <ul className="divide-y border rounded-md">
            {filtered.slice().sort((a, b) => a.data_show.localeCompare(b.data_show)).map((s) => (
              <li key={s.id} className="p-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link to="/shows" className="font-medium hover:underline truncate block">
                    {s.artist_nome ?? "—"} · {fmtDate(s.data_show)}
                  </Link>
                  <p className="text-xs text-muted-foreground truncate">
                    {[s.cidade, s.local].filter(Boolean).join(" — ") || "Local não informado"}
                    {s.vendedor && ` · Vend.: ${s.vendedor}`}
                  </p>
                  {extraHeader && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      <span className="font-medium">{extraHeader}:</span> {extraValue(s)}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="text-sm font-semibold">{fmtBRL(Number(s.cache_total ?? 0))}</span>
                  <Badge className={STATUS_CLASS[s.status] ?? ""}>{STATUS_LABEL[s.status] ?? s.status}</Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SheetContent>
    </Sheet>
  );
}
