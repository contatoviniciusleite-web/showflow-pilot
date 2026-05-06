import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, CalendarClock, CheckCircle2, Ban, Wallet, Download, Clock } from "lucide-react";
import { fmtBRL, fmtDateBR } from "@/lib/exporters";
import { useAuth } from "@/contexts/AuthContext";
import { canManagePaymentOrders, canViewPaymentOrders } from "@/lib/permissions";
import { ExportPaymentOrdersDialog } from "@/components/pagamentos/ExportPaymentOrdersDialog";
import { TIPO_LABEL, STATUS_LABEL } from "@/lib/paymentOrders";
import { SchedulePaymentDialog } from "@/components/pagamentos/SchedulePaymentDialog";
import { MarkAsPaidDialog } from "@/components/pagamentos/MarkAsPaidDialog";
import { CancelPaymentDialog } from "@/components/pagamentos/CancelPaymentDialog";
import { BulkPayDialog } from "@/components/pagamentos/BulkPayDialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Order = {
  id: string;
  closing_id: string;
  artist_id: string;
  tipo: string;
  beneficiario_nome: string;
  beneficiario_id: string | null;
  descricao: string;
  valor: number;
  data_sugerida: string;
  data_pagamento: string | null;
  status: string;
  forma_pagamento: string | null;
  valor_pago: number | null;
  comprovante_path: string | null;
  closing?: {
    semana_inicio: string;
    semana_fim: string;
    artists?: { nome: string } | null;
  } | null;
};

const TIPO_BADGE: Record<string, string> = {
  artista: "bg-emerald-700 text-white",
  socio: "bg-purple-600 text-white",
  equipe: "bg-blue-600 text-white",
  vendedor: "bg-orange-500 text-white",
  despesa: "bg-gray-500 text-white",
  clipe: "bg-pink-500 text-white",
};

const STATUS_BADGE: Record<string, string> = {
  pendente: "bg-amber-400 text-black",
  agendado: "bg-sky-400 text-black",
  pago: "bg-emerald-500 text-white",
  cancelado: "bg-red-500 text-white",
};

export default function Pagamentos() {
  const { roles } = useAuth();
  const canManage = canManagePaymentOrders(roles);

  const [rows, setRows] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [artists, setArtists] = useState<{ id: string; nome: string }[]>([]);
  const [filterArtist, setFilterArtist] = useState("__all");
  const [filterStatus, setFilterStatus] = useState("__all");
  const [filterTipo, setFilterTipo] = useState("__all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [openSchedule, setOpenSchedule] = useState(false);
  const [openPay, setOpenPay] = useState(false);
  const [openCancel, setOpenCancel] = useState(false);
  const [openBulk, setOpenBulk] = useState(false);
  const [actionOrder, setActionOrder] = useState<Order | null>(null);

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("payment_orders")
      .select("*, closing:weekly_closings(semana_inicio, semana_fim, artists(nome))")
      .order("data_sugerida", { ascending: false });
    if (filterArtist !== "__all") q = q.eq("artist_id", filterArtist);
    if (filterStatus !== "__all") q = q.eq("status", filterStatus);
    if (filterTipo !== "__all") q = q.eq("tipo", filterTipo);
    if (from) q = q.gte("data_sugerida", from);
    if (to) q = q.lte("data_sugerida", to);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setRows((data ?? []) as any);
    setSelected(new Set());
    setLoading(false);
  };

  useEffect(() => {
    supabase.from("artists").select("id, nome").eq("ativo", true).order("nome")
      .then(({ data }) => setArtists((data ?? []) as any));
  }, []);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filterArtist, filterStatus, filterTipo, from, to]);

  // Cards de resumo
  const summary = useMemo(() => {
    const aPagar = rows.filter((r) => r.status === "pendente" || r.status === "agendado");
    const pagas = rows.filter((r) => r.status === "pago");
    return {
      totalAPagar: aPagar.reduce((a, r) => a + Number(r.valor || 0), 0),
      totalPago: pagas.reduce((a, r) => a + Number(r.valor_pago ?? r.valor ?? 0), 0),
      qtdPendentes: aPagar.length,
      qtdPagas: pagas.length,
    };
  }, [rows]);

  // Agrupamento por fechamento
  const grouped = useMemo(() => {
    const map = new Map<string, { closing: Order["closing"]; orders: Order[] }>();
    for (const r of rows) {
      if (!map.has(r.closing_id)) map.set(r.closing_id, { closing: r.closing, orders: [] });
      map.get(r.closing_id)!.orders.push(r);
    }
    return Array.from(map.entries());
  }, [rows]);

  const toggleSelect = (id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const downloadComprovante = async (path: string) => {
    const { data, error } = await supabase.storage.from("comprovantes-pagamentos").createSignedUrl(path, 60);
    if (error) return toast.error(error.message);
    window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-semibold">Pagamentos</h1>
        <p className="text-muted-foreground mt-1">Ordens de pagamento geradas a partir dos fechamentos finalizados.</p>
      </div>

      {/* Filtros */}
      <Card className="p-4 mb-4 grid grid-cols-1 md:grid-cols-5 gap-3 shadow-soft">
        <div className="space-y-1.5">
          <Label>Artista</Label>
          <Select value={filterArtist} onValueChange={setFilterArtist}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todos</SelectItem>
              {artists.map((a) => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>De</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Até</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todos</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="agendado">Agendado</SelectItem>
              <SelectItem value="pago">Pago</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Tipo</Label>
          <Select value={filterTipo} onValueChange={setFilterTipo}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todos</SelectItem>
              {Object.entries(TIPO_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card className="p-4 shadow-soft">
          <div className="flex items-center gap-2 text-muted-foreground text-xs"><Wallet className="h-4 w-4" />A pagar</div>
          <div className="text-xl font-semibold mt-1">{fmtBRL(summary.totalAPagar)}</div>
        </Card>
        <Card className="p-4 shadow-soft">
          <div className="flex items-center gap-2 text-muted-foreground text-xs"><CheckCircle2 className="h-4 w-4" />Pago</div>
          <div className="text-xl font-semibold mt-1">{fmtBRL(summary.totalPago)}</div>
        </Card>
        <Card className="p-4 shadow-soft">
          <div className="flex items-center gap-2 text-muted-foreground text-xs"><Clock className="h-4 w-4" />Ordens pendentes</div>
          <div className="text-xl font-semibold mt-1">{summary.qtdPendentes}</div>
        </Card>
        <Card className="p-4 shadow-soft">
          <div className="flex items-center gap-2 text-muted-foreground text-xs"><CheckCircle2 className="h-4 w-4" />Ordens pagas</div>
          <div className="text-xl font-semibold mt-1">{summary.qtdPagas}</div>
        </Card>
      </div>

      {canManage && selected.size > 0 && (
        <div className="mb-3 p-3 rounded-md border bg-muted/50 flex items-center justify-between">
          <span className="text-sm">{selected.size} ordem(ns) selecionada(s)</span>
          <Button size="sm" onClick={() => setOpenBulk(true)}>
            <CheckCircle2 className="h-4 w-4 mr-2" />Marcar selecionadas como pagas
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : grouped.length === 0 ? (
        <Card className="p-12 text-center shadow-soft">
          <Wallet className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Nenhuma ordem de pagamento encontrada.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {grouped.map(([closingId, group]) => {
            const total = group.orders.reduce((a, r) => a + Number(r.valor || 0), 0);
            const pagas = group.orders.filter((o) => o.status === "pago").length;
            const pendentes = group.orders.filter((o) => o.status === "pendente" || o.status === "agendado").length;
            return (
              <Card key={closingId} className="shadow-soft overflow-hidden">
                <div className="px-4 py-3 bg-muted/40 border-b flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <Link to={`/fechamento/${closingId}`} className="font-semibold hover:underline">
                      {group.closing?.artists?.nome ?? "—"} · {fmtDateBR(group.closing?.semana_inicio ?? "")} a {fmtDateBR(group.closing?.semana_fim ?? "")}
                    </Link>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {group.orders.length} ordens · {fmtBRL(total)} total · {pagas} pagas · {pendentes} pendentes
                    </p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/20">
                      <tr className="text-left">
                        {canManage && <th className="px-3 py-2 w-8"></th>}
                        <th className="px-3 py-2 font-medium">Tipo</th>
                        <th className="px-3 py-2 font-medium">Beneficiário</th>
                        <th className="px-3 py-2 font-medium">Descrição</th>
                        <th className="px-3 py-2 font-medium text-right">Valor</th>
                        <th className="px-3 py-2 font-medium">Data</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.orders.map((o) => (
                        <tr key={o.id} className="border-t hover:bg-muted/20">
                          {canManage && (
                            <td className="px-3 py-2">
                              <Checkbox
                                checked={selected.has(o.id)}
                                disabled={o.status === "pago" || o.status === "cancelado"}
                                onCheckedChange={() => toggleSelect(o.id)}
                              />
                            </td>
                          )}
                          <td className="px-3 py-2">
                            <span className={cn("inline-flex px-2 py-0.5 rounded-full text-xs font-medium", TIPO_BADGE[o.tipo] ?? "bg-muted")}>
                              {TIPO_LABEL[o.tipo] ?? o.tipo}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-medium">{o.beneficiario_nome}</td>
                          <td className="px-3 py-2 text-muted-foreground text-xs max-w-[280px] truncate">{o.descricao}</td>
                          <td className="px-3 py-2 text-right font-medium whitespace-nowrap">
                            {fmtBRL(o.valor_pago ?? o.valor)}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs">
                            {fmtDateBR(o.data_pagamento ?? o.data_sugerida)}
                          </td>
                          <td className="px-3 py-2">
                            <span className={cn("inline-flex px-2 py-0.5 rounded-full text-xs font-medium", STATUS_BADGE[o.status] ?? "bg-muted")}>
                              {STATUS_LABEL[o.status] ?? o.status}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">
                            {o.comprovante_path && (
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => downloadComprovante(o.comprovante_path!)}>
                                <Download className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {canManage && o.status === "pendente" && (
                              <Button size="sm" variant="ghost" onClick={() => { setActionOrder(o); setOpenSchedule(true); }}>
                                <CalendarClock className="h-3.5 w-3.5 mr-1" />Agendar
                              </Button>
                            )}
                            {canManage && (o.status === "pendente" || o.status === "agendado") && (
                              <Button size="sm" variant="default" className="ml-1"
                                onClick={() => { setActionOrder(o); setOpenPay(true); }}>
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Pagar
                              </Button>
                            )}
                            {canManage && o.status !== "pago" && o.status !== "cancelado" && (
                              <Button size="icon" variant="ghost" className="h-7 w-7 ml-1 text-destructive"
                                onClick={() => { setActionOrder(o); setOpenCancel(true); }}>
                                <Ban className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <SchedulePaymentDialog
        open={openSchedule} onOpenChange={setOpenSchedule}
        orderId={actionOrder?.id ?? null}
        dataSugerida={actionOrder?.data_sugerida ?? null}
        onDone={load}
      />
      <MarkAsPaidDialog
        open={openPay} onOpenChange={setOpenPay}
        order={actionOrder ? {
          id: actionOrder.id, valor: Number(actionOrder.valor),
          beneficiario_id: actionOrder.beneficiario_id,
          beneficiario_nome: actionOrder.beneficiario_nome,
          descricao: actionOrder.descricao,
        } : null}
        onDone={load}
      />
      <CancelPaymentDialog
        open={openCancel} onOpenChange={setOpenCancel}
        orderId={actionOrder?.id ?? null}
        onDone={load}
      />
      <BulkPayDialog
        open={openBulk} onOpenChange={setOpenBulk}
        orderIds={Array.from(selected)}
        onDone={load}
      />
    </div>
  );
}
