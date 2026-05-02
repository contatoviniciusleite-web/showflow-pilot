import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Trash2, Plus, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { canRegisterPayment, canConfirmPayment, canDeletePayment, canViewConfirmedBy } from "@/lib/permissions";

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

export function PaymentsTab({ showId, status, confirmadoPorNome, confirmadoEm, onChanged }: Props) {
  const { roles } = useAuth();
  const [items, setItems] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // form
  const [valor, setValor] = useState(0);
  const [data, setData] = useState(format(new Date(), "yyyy-MM-dd"));
  const [forma, setForma] = useState("pix");
  const [conta, setConta] = useState("");
  const [obs, setObs] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("shows-admin", {
      body: { action: "list_payments", show_id: showId },
    });
    if (error) toast.error(error.message);
    setItems((data?.payments ?? []) as Payment[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [showId]);

  const reset = () => {
    setValor(0); setData(format(new Date(), "yyyy-MM-dd")); setForma("pix"); setConta(""); setObs("");
  };

  const submit = async () => {
    if (valor <= 0) return toast.error("Informe o valor");
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
    toast.success("Pagamento registrado");
    setOpen(false); reset(); load(); onChanged?.();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este pagamento?")) return;
    const { error } = await supabase.functions.invoke("shows-admin", { body: { action: "delete_payment", id } });
    if (error) return toast.error(error.message);
    toast.success("Pagamento excluído"); load(); onChanged?.();
  };

  const confirmPayment = async () => {
    if (!confirm("Confirmar o pagamento deste show?")) return;
    const { error } = await supabase.functions.invoke("shows-admin", {
      body: { action: "confirm_payment", id: showId },
    });
    if (error) return toast.error(error.message);
    toast.success("Pagamento confirmado"); onChanged?.();
  };

  const canRegister = canRegisterPayment(roles);
  const canConfirm = canConfirmPayment(roles) && status !== "confirmado" && status !== "cancelada";
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

      <div className="flex justify-end gap-2">
        {canConfirm && (
          <Button size="sm" variant="default" onClick={confirmPayment}>
            <CheckCircle2 className="h-4 w-4 mr-2" /> Confirmar pagamento
          </Button>
        )}
        {canRegister && (
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Registrar Pagamento Manual
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : items.length === 0 ? (
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          Nenhum pagamento registrado.
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((p) => (
            <li key={p.id} className="border rounded-md p-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">
                  {Number(p.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  <span className="text-muted-foreground font-normal"> · {FORMA_LABEL[p.forma_pagamento] ?? p.forma_pagamento}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Em {format(new Date(p.data_pagamento + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })}
                  {p.conta_destino ? ` · ${p.conta_destino}` : ""}
                  {p.registrado_por_nome ? ` · por ${p.registrado_por_nome}` : ""}
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar Pagamento Manual</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Valor pago *</Label>
              <CurrencyInput value={valor} onValueChange={setValor} />
            </div>
            <div>
              <Label>Data do pagamento *</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
            <div>
              <Label>Forma de pagamento</Label>
              <Select value={forma} onValueChange={setForma}>
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
              <Input value={conta} onChange={(e) => setConta(e.target.value)} placeholder="Ex.: Banco do Brasil ag 1234" />
            </div>
            <div>
              <Label>Observações *</Label>
              <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3} placeholder="Obrigatório na baixa manual" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={saving}>{saving ? "Salvando…" : "Registrar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
