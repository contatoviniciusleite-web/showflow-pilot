import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export function BulkPayDialog({
  open, onOpenChange, orderIds, onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  orderIds: string[];
  onDone: () => void;
}) {
  const { user } = useAuth();
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [forma, setForma] = useState("pix");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (orderIds.length === 0) return;
    setSaving(true);
    try {
      // Buscar para preencher valor_pago = valor
      const { data: orders } = await supabase
        .from("payment_orders").select("id, valor, beneficiario_id, descricao").in("id", orderIds);
      const nowIso = new Date().toISOString();
      for (const o of orders ?? []) {
        await supabase.from("payment_orders").update({
          status: "pago",
          valor_pago: o.valor,
          data_pagamento: data,
          forma_pagamento: forma,
          pago_por: user?.id ?? null,
          pago_em: nowIso,
        }).eq("id", o.id);
        if (o.beneficiario_id) {
          const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(o.valor));
          await supabase.from("notifications").insert({
            user_id: o.beneficiario_id,
            tipo: "pagamento_confirmado",
            titulo: "Pagamento confirmado",
            mensagem: `Seu pagamento de ${fmt} foi confirmado: ${o.descricao}`,
          });
        }
      }
      toast.success(`${orderIds.length} ordens marcadas como pagas`);
      onDone();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Marcar {orderIds.length} ordens como pagas</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Data *</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Forma</Label>
            <Select value={forma} onValueChange={setForma}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="transferencia">Transferência</SelectItem>
                <SelectItem value="dinheiro">Dinheiro</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
