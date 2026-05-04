import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { STATUS_CLASS, STATUS_LABEL } from "@/lib/showStatus";
import { ShowDetailsModal } from "@/components/shows/ShowDetailsModal";
import { AlertTriangle, Clock, DollarSign, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { ExportMenu } from "@/components/ExportMenu";
import { exportCSV, exportPDF, type Column } from "@/lib/exporters";

interface FinShow {
  id: string;
  artist_id: string;
  artist_nome?: string | null;
  artist_cor?: string | null;
  artist_cache_minimo?: number | null;
  data_show: string;
  local: string | null;
  cidade: string | null;
  cache_total: number;
  total_pago: number;
  status: string;
  vendedor: string | null;
  created_by: string | null;
  confirmado_em: string | null;
  confirmado_por_nome: string | null;
  prazo_comprovante_em: string | null;
  aprovado_em: string | null;
}

const fmtBRL = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d: string | null) => {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
};

const EXTRA_LABEL: Record<string, string> = { atrasado: "ATRASADO" };
const EXTRA_CLASS: Record<string, string> = {
  atrasado: "bg-red-600 hover:bg-red-600 text-white",
};

function effectiveStatus(s: FinShow): string {
  if (
    s.status === "aguardando_pagamento" &&
    s.prazo_comprovante_em &&
    new Date(s.prazo_comprovante_em) < new Date()
  ) {
    return "atrasado";
  }
  return s.status;
}

export default function Financeiro() {
  const queryClient = useQueryClient();
  const [active, setActive] = useState<FinShow | null>(null);

  const [fArtist, setFArtist] = useState<string>("all");
  const [fStatus, setFStatus] = useState<string>("all");
  const [fFrom, setFFrom] = useState<string>("");
  const [fTo, setFTo] = useState<string>("");

  const finQuery = useQuery({
    queryKey: ["financeiro"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("shows-admin", {
        body: { action: "finance_summary" },
      });
      if (error) throw new Error(error.message);
      return (data?.shows ?? []) as FinShow[];
    },
  });
  const shows = finQuery.data ?? [];
  const loading = finQuery.isLoading;
  const load = () => queryClient.invalidateQueries({ queryKey: ["financeiro"] });

  useRealtimeInvalidate({
    channel: "financeiro-page",
    tables: ["shows", "show_payments"],
    queryKeys: [["financeiro"]],
    debounceMs: 400,
  });

  const artists = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of shows) if (s.artist_id) m.set(s.artist_id, s.artist_nome ?? "—");
    return Array.from(m.entries()).map(([id, nome]) => ({ id, nome }));
  }, [shows]);

  const filtered = useMemo(() => {
    return shows.filter((s) => {
      if (fArtist !== "all" && s.artist_id !== fArtist) return false;
      const eff = effectiveStatus(s);
      if (fStatus !== "all" && eff !== fStatus) return false;
      if (fFrom && s.data_show < fFrom) return false;
      if (fTo && s.data_show > fTo) return false;
      return true;
    });
  }, [shows, fArtist, fStatus, fFrom, fTo]);

  const monthIso = new Date().toISOString().slice(0, 7);
  const totals = useMemo(() => {
    let aReceber = 0;
    let recebidoMes = 0;
    let aguardandoPag = 0;
    let aguardandoConfirmacao = 0;
    let atrasados = 0;
    for (const s of shows) {
      const eff = effectiveStatus(s);
      if (eff === "cancelada") continue;
      const restante = Math.max(0, Number(s.cache_total) - Number(s.total_pago));
      if (eff === "confirmado" || eff === "aguardando_pagamento" || eff === "comprovante_enviado" || eff === "atrasado") {
        aReceber += restante;
      }
      if (s.data_show && s.data_show.startsWith(monthIso)) {
        recebidoMes += Number(s.total_pago);
      }
      if (eff === "aguardando_pagamento") aguardandoPag += 1;
      if (eff === "comprovante_enviado") aguardandoConfirmacao += 1;
      if (eff === "atrasado") atrasados += 1;
    }
    return { aReceber, recebidoMes, aguardandoPag, aguardandoConfirmacao, atrasados };
  }, [shows, monthIso]);

  const today = new Date();
  const in7 = new Date(today.getTime() + 7 * 86400000);
  const proximos = shows.filter((s) => {
    const d = new Date(s.data_show + "T00:00:00");
    const eff = effectiveStatus(s);
    return d >= today && d <= in7 && eff !== "cancelada" && eff !== "confirmado";
  });
  const atrasados = shows.filter((s) => effectiveStatus(s) === "atrasado");
  const aguardandoConfirm = shows.filter((s) => effectiveStatus(s) === "comprovante_enviado");

  const exportFinanceiro = (kind: "pdf" | "csv") => {
    const cols: Column[] = [
      { header: "Artista", key: (r: FinShow) => r.artist_nome ?? "—" },
      { header: "Data", key: (r: FinShow) => fmtDate(r.data_show) },
      { header: "Local", key: (r: FinShow) => [r.local, r.cidade].filter(Boolean).join(" · ") || "—" },
      { header: "Cachê", key: (r: FinShow) => fmtBRL(Number(r.cache_total)), align: "right" },
      { header: "Pago", key: (r: FinShow) => fmtBRL(Number(r.total_pago)), align: "right" },
      {
        header: "A receber",
        key: (r: FinShow) => fmtBRL(Math.max(0, Number(r.cache_total) - Number(r.total_pago))),
        align: "right",
      },
      {
        header: "Status",
        key: (r: FinShow) => {
          const eff = effectiveStatus(r);
          return (STATUS_LABEL as any)[eff] ?? EXTRA_LABEL[eff] ?? eff;
        },
      },
    ];
    const totalBruto = filtered.reduce((a, r) => a + Number(r.cache_total || 0), 0);
    const totalPago = filtered.reduce((a, r) => a + Number(r.total_pago || 0), 0);
    const filterLines: string[] = [];
    if (fArtist !== "all") {
      const a = artists.find((x) => x.id === fArtist);
      filterLines.push(`Artista: ${a?.nome ?? "—"}`);
    }
    if (fStatus !== "all") filterLines.push(`Status: ${fStatus}`);
    if (fFrom) filterLines.push(`De: ${fmtDate(fFrom)}`);
    if (fTo) filterLines.push(`Até: ${fmtDate(fTo)}`);
    const meta = {
      title: "Financeiro — Shows",
      filters: filterLines,
      filename: `financeiro-${new Date().toISOString().slice(0, 10)}`,
      summary: [
        { label: "Total de shows", value: String(filtered.length) },
        { label: "Cachê total", value: fmtBRL(totalBruto) },
        { label: "Total pago", value: fmtBRL(totalPago) },
        { label: "A receber", value: fmtBRL(Math.max(0, totalBruto - totalPago)) },
      ],
    };
    if (kind === "pdf") exportPDF(filtered, cols, meta);
    else exportCSV(filtered, cols, meta);
  };

  const exportConsolidado = async (kind: "pdf" | "csv") => {
    const { data, error } = await supabase.functions.invoke("shows-admin", {
      body: {
        action: "list_payments_consolidated",
        from: fFrom || null,
        to: fTo || null,
        artist_id: fArtist,
        status: fStatus === "all" ? "all" : fStatus === "confirmado" ? "confirmado" : "em_aberto",
      },
    });
    if (error) return;
    const rows = (data?.rows ?? []) as any[];
    if (rows.length === 0) return;
    const cols: Column[] = [
      { header: "Artista", key: (r: any) => r.artist_nome ?? "—" },
      { header: "Data show", key: (r: any) => fmtDate(r.data_show) },
      { header: "Local", key: (r: any) => [r.local, r.cidade].filter(Boolean).join(" · ") || "—" },
      { header: "Cachê", key: (r: any) => fmtBRL(Number(r.cache_total)), align: "right" },
      { header: "Total pago", key: (r: any) => fmtBRL(Number(r.total_pago_show)), align: "right" },
      { header: "Saldo", key: (r: any) => fmtBRL(Math.max(0, Number(r.saldo_aberto))), align: "right" },
      { header: "Status", key: (r: any) => (STATUS_LABEL as any)[r.status] ?? r.status },
      { header: "Data baixa", key: (r: any) => fmtDate(r.data_pagamento) },
      { header: "Valor baixa", key: (r: any) => fmtBRL(Number(r.valor)), align: "right" },
      { header: "Forma", key: (r: any) => r.forma_pagamento },
      { header: "Confirmado por", key: (r: any) => r.confirmado_por ?? "—" },
    ];
    const totalBaixas = rows.reduce((a, r) => a + Number(r.valor || 0), 0);
    const filterLines: string[] = [];
    if (fArtist !== "all") {
      const a = artists.find((x) => x.id === fArtist);
      filterLines.push(`Artista: ${a?.nome ?? "—"}`);
    }
    if (fStatus !== "all") filterLines.push(`Status: ${fStatus}`);
    if (fFrom) filterLines.push(`De: ${fmtDate(fFrom)}`);
    if (fTo) filterLines.push(`Até: ${fmtDate(fTo)}`);
    const meta = {
      title: "Extrato consolidado de baixas",
      filters: filterLines,
      filename: `extrato-consolidado-${new Date().toISOString().slice(0, 10)}`,
      summary: [
        { label: "Total de baixas", value: String(rows.length) },
        { label: "Valor total das baixas", value: fmtBRL(totalBaixas) },
      ],
    };
    if (kind === "pdf") exportPDF(rows, cols, meta);
    else exportCSV(rows, cols, meta);
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl md:text-3xl font-semibold">Financeiro</h1>
        <p className="text-muted-foreground mt-1">Pagamentos, comprovantes e fluxo financeiro de todos os shows.</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total a receber" value={fmtBRL(totals.aReceber)} icon={<Wallet className="h-4 w-4" />} />
        <StatCard title="Recebido no mês" value={fmtBRL(totals.recebidoMes)} icon={<DollarSign className="h-4 w-4" />} />
        <StatCard title="Aguardando pagamento" value={String(totals.aguardandoPag)} icon={<Clock className="h-4 w-4" />} />
        <StatCard title="Aguardando confirmação" value={String(totals.aguardandoConfirmacao)} icon={<AlertTriangle className="h-4 w-4" />} />
      </div>

      {(atrasados.length > 0 || aguardandoConfirm.length > 0 || proximos.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <AlertList
            color="red"
            title={`Pagamento atrasado (${atrasados.length})`}
            items={atrasados.slice(0, 5)}
            onOpen={setActive}
          />
          <AlertList
            color="orange"
            title={`Comprovante aguardando confirmação (${aguardandoConfirm.length})`}
            items={aguardandoConfirm.slice(0, 5)}
            onOpen={setActive}
          />
          <AlertList
            color="yellow"
            title={`A vencer em 7 dias (${proximos.length})`}
            items={proximos.slice(0, 5)}
            onOpen={setActive}
          />
        </div>
      )}

      <Card className="p-4 shadow-soft space-y-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Artista</label>
            <Select value={fArtist} onValueChange={setFArtist}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {artists.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Status</label>
            <Select value={fStatus} onValueChange={setFStatus}>
              <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="aguardando_pagamento">Aguardando pagamento</SelectItem>
                <SelectItem value="comprovante_enviado">Comprovante enviado</SelectItem>
                <SelectItem value="confirmado">Confirmado</SelectItem>
                <SelectItem value="atrasado">Atrasado</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">De</label>
            <Input type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} className="w-[160px]" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Até</label>
            <Input type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} className="w-[160px]" />
          </div>
          <Button variant="ghost" onClick={() => { setFArtist("all"); setFStatus("all"); setFFrom(""); setFTo(""); }}>
            Limpar
          </Button>
          <div className="ml-auto flex gap-2">
            <ExportMenu
              label="Exportar shows"
              disabled={filtered.length === 0}
              onExportPDF={() => exportFinanceiro("pdf")}
              onExportCSV={() => exportFinanceiro("csv")}
            />
            <ExportMenu
              label="Extrato consolidado"
              onExportPDF={() => exportConsolidado("pdf")}
              onExportCSV={() => exportConsolidado("csv")}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Artista</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Local</TableHead>
                <TableHead className="text-right">Cachê</TableHead>
                <TableHead className="text-right">Pago</TableHead>
                <TableHead className="text-right">A receber</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 8 }).map((__, j) => (
                      <TableCell key={j}><div className="h-4 w-full bg-muted rounded animate-pulse" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Nenhum show encontrado.</TableCell></TableRow>
              ) : filtered.map((s) => {
                const eff = effectiveStatus(s);
                const cls = (STATUS_CLASS as any)[eff] ?? EXTRA_CLASS[eff] ?? "";
                const label = (STATUS_LABEL as any)[eff] ?? EXTRA_LABEL[eff] ?? eff;
                const restante = Math.max(0, Number(s.cache_total) - Number(s.total_pago));
                return (
                  <TableRow key={s.id}>
                    <TableCell>
                      <span className="inline-flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.artist_cor ?? "hsl(var(--primary))" }} />
                        {s.artist_nome ?? "—"}
                      </span>
                    </TableCell>
                    <TableCell>{fmtDate(s.data_show)}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{s.local ?? "—"}{s.cidade ? ` · ${s.cidade}` : ""}</TableCell>
                    <TableCell className="text-right">{fmtBRL(Number(s.cache_total))}</TableCell>
                    <TableCell className="text-right">{fmtBRL(Number(s.total_pago))}</TableCell>
                    <TableCell className="text-right">{fmtBRL(restante)}</TableCell>
                    <TableCell><Badge className={cls}>{label}</Badge></TableCell>
                    <TableCell><Button size="sm" variant="ghost" onClick={() => setActive(s)}>Abrir</Button></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      <ShowDetailsModal show={active as any} open={!!active} onClose={() => setActive(null)} onChanged={load} />
    </div>
  );
}

function StatCard({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return (
    <Card className="p-4 shadow-soft">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{title}</p>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <p className="text-2xl font-semibold mt-2">{value}</p>
    </Card>
  );
}

function AlertList({
  color,
  title,
  items,
  onOpen,
}: {
  color: "red" | "orange" | "yellow";
  title: string;
  items: FinShow[];
  onOpen: (s: FinShow) => void;
}) {
  const border = {
    red: "border-red-500/50 bg-red-500/5",
    orange: "border-orange-500/50 bg-orange-500/5",
    yellow: "border-yellow-500/50 bg-yellow-500/5",
  }[color];
  return (
    <Card className={cn("p-4 shadow-soft border", border)}>
      <p className="font-medium mb-2">{title}</p>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nada por aqui.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((s) => (
            <li key={s.id} className="flex items-center justify-between text-sm gap-2">
              <span className="truncate">
                <strong>{s.artist_nome ?? "—"}</strong> · {fmtDate(s.data_show)}{s.cidade ? ` · ${s.cidade}` : ""}
              </span>
              <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => onOpen(s)}>Abrir</Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
