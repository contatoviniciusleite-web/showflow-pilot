import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { canRegisterPayment, canDeletePayment, canViewConfirmedBy } from "@/lib/permissions";
import { formatCurrencyBRL } from "@/lib/masks";

interface Payment {
  id: string;
  show_id: string;
  valor: number;
  data_pagamento: string;
  forma_pagamento: string;
  conta_destino: string | null;
  observacoes: string | null;
  attachment_id: string | null;
  registrado_por_nome: string | null;
  created_at: string;
}

interface Props {
  showId: string;
  status: string;
  confirmadoPorNome?: string | null;
  confirmadoEm?: string | null;
  onChanged?: () => void;
}

const FORMA_LABEL: Record<string, string> = {
  pix: "PIX", transferencia: "Transferência", especie: "Espécie", outro: "Outro",
};

export function PaymentsTab({ showId, status: statusProp, confirmadoPorNome, confirmadoEm, onChanged }: Props) {
  const { roles } = useAuth();
  const [items, setItems] = useState<Payment[]>([]);
  const [cacheTotal, setCacheTotal] = useState(0);
  const [totalPago, setTotalPago] = useState(0);
  const [status, setStatus] = useState(statusProp);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // form
  const [valor, setValor] = useState(0);
  const [data, setData] = useState(format(new Date(), "yyyy-MM-dd"));
  const [forma, setForma] = useState("pix");
  const [conta, setConta] = useState("");
  const [obs, setObs] = useState("");

  const saldo = useMemo(() => Math.max(0, cacheTotal - totalPago), [cacheTotal, totalPago]);
  const quitado = cacheTotal > 0 && saldo <= 0.005;

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("shows-admin", {
      body: { action: "list_payments", show_id: showId },
    });
    if (error) toast.error(error.message);
    setItems((data?.payments ?? []) as Payment[]);
    setCacheTotal(Number(data?.cache_total ?? 0));
    setTotalPago(Number(data?.total_pago ?? 0));
    if (data?.status) setStatus(data.status);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [showId]);

  // Prefill com saldo em aberto
  useEffect(() => {
    if (!loading) setValor(saldo);
    // eslint-disable-next-line
  }, [saldo, loading]);

  const submit = async () => {
    if (valor <= 0) return toast.error("Informe o valor");
    if (valor > saldo + 0.005) {
      return toast.error(`O valor informado é maior que o saldo em aberto (${formatCurrencyBRL(saldo)}). Verifique o valor.`);
    }
    if (!data) return toast.error("Informe a data");
    if (!obs.trim()) return toast.error("Observações são obrigatórias na baixa manual");
    setSaving(true);
    const { error } = await supabase.functions.invoke("shows-admin", {
      body: {
        action: "register_payment",
        show_id: showId,
        valor, data_pagamento: data, forma_pagamento: forma,
        conta_destino: conta, observacoes: obs,
      },
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Baixa registrada");
    setObs(""); setConta("");
    await load();
    onChanged?.();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir esta baixa?")) return;
    const { error } = await supabase.functions.invoke("shows-admin", { body: { action: "delete_payment", id } });
    if (error) return toast.error(error.message);
    toast.success("Baixa excluída"); load(); onChanged?.();
  };

  const canRegister = canRegisterPayment(roles);
  const canDelete = canDeletePayment(roles);
  const showConfirmedBy = canViewConfirmedBy(roles) && status === "confirmado" && confirmadoPorNome;

  return (
    <div className="space-y-4">
      {showConfirmedBy && (
        <div className="rounded-md bg-green-500/10 border border-green-500/30 p-3 text-sm">
          ✓ Confirmado por <strong>{confirmadoPorNome}</strong>
          {confirmadoEm && <> em {format(new Date(confirmadoEm), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</>}
        </div>
      )}

      {/* Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Cachê total</p>
          <p className="font-semibold">{formatCurrencyBRL(cacheTotal)}</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Total confirmado</p>
          <p className="font-semibold">{formatCurrencyBRL(totalPago)}</p>
        </div>
        <div className={`rounded-md border p-3 ${quitado ? "bg-green-500/10 border-green-500/30" : "bg-amber-500/10 border-amber-500/30"}`}>
          <p className="text-xs text-muted-foreground">{quitado ? "Status" : "Em aberto"}</p>
          <p className="font-semibold">{quitado ? "Pagamento quitado" : formatCurrencyBRL(saldo)}</p>
        </div>
      </div>

      {/* Painel de baixa */}
      {canRegister && (
        <div className="rounded-md border p-4 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <h3 className="font-medium">Registrar baixa de pagamento</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Valor da baixa *</Label>
              <CurrencyInput value={valor} onValueChange={setValor} disabled={quitado} />
            </div>
            <div>
              <Label>Data do pagamento *</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} disabled={quitado} />
            </div>
            <div>
              <Label>Forma de pagamento</Label>
              <Select value={forma} onValueChange={setForma} disabled={quitado}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="transferencia">Transferência</SelectItem>
                  <SelectItem value="especie">Espécie</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Conta de destino</Label>
              <Input value={conta} onChange={(e) => setConta(e.target.value)} placeholder="Ex.: Banco do Brasil ag 1234" disabled={quitado} />
            </div>
            <div className="sm:col-span-2">
              <Label>Observações *</Label>
              <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} placeholder="Obrigatório na baixa manual" disabled={quitado} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={submit} disabled={saving || quitado || valor <= 0}>
              {quitado ? "Pagamento quitado" : saving ? "Salvando…" : "Registrar Baixa"}
            </Button>
          </div>
        </div>
      )}

      {/* Histórico */}
      <div>
        <h3 className="font-medium mb-2">Histórico de baixas</h3>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : items.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nenhuma baixa registrada.
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((p) => (
              <li key={p.id} className="border rounded-md p-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">
                    {formatCurrencyBRL(Number(p.valor))}
                    <span className="text-muted-foreground font-normal"> · {FORMA_LABEL[p.forma_pagamento] ?? p.forma_pagamento}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Pago em {format(new Date(p.data_pagamento + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })}
                    {p.conta_destino ? ` · ${p.conta_destino}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Confirmado por {p.registrado_por_nome ?? "—"} em {format(new Date(p.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    {p.attachment_id ? " · comprovante vinculado" : ""}
                  </p>
                  {p.observacoes && <p className="text-xs mt-1">{p.observacoes}</p>}
                </div>
                {canDelete && (
                  <Button size="icon" variant="ghost" onClick={() => remove(p.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
