import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencyInput } from "@/components/ui/currency-input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type Order = {
  id: string;
  valor: number;
  beneficiario_id: string | null;
  beneficiario_nome: string;
  descricao: string;
};

export function MarkAsPaidDialog({
  open, onOpenChange, order, onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  order: Order | null;
  onDone: () => void;
}) {
  const { user } = useAuth();
  const [valor, setValor] = useState(0);
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [forma, setForma] = useState("pix");
  const [obs, setObs] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (order) { setValor(order.valor); setObs(""); setFile(null); }
  }, [order]);

  const submit = async () => {
    if (!order) return;
    if (!data) return toast.error("Data é obrigatória");
    setSaving(true);
    try {
      let comprovante_path: string | null = null;
      if (file) {
        if (file.size > 10 * 1024 * 1024) throw new Error("Arquivo maior que 10MB");
        const ext = file.name.split(".").pop();
        const path = `${order.id}/${Date.now()}.${ext}`;
        const up = await supabase.storage.from("comprovantes-pagamentos").upload(path, file, { upsert: false });
        if (up.error) throw up.error;
        comprovante_path = path;
      }
      const { error } = await supabase.from("payment_orders").update({
        status: "pago",
        valor_pago: valor,
        data_pagamento: data,
        forma_pagamento: forma,
        comprovante_path,
        observacoes: obs || null,
        pago_por: user?.id ?? null,
        pago_em: new Date().toISOString(),
      }).eq("id", order.id);
      if (error) throw error;

      // Notificação ao beneficiário (se for usuário)
      if (order.beneficiario_id) {
        const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
        await supabase.from("notifications").insert({
          user_id: order.beneficiario_id,
          tipo: "pagamento_confirmado",
          titulo: "Pagamento confirmado",
          mensagem: `Seu pagamento de ${fmt} foi confirmado: ${order.descricao}`,
        });
      }

      toast.success("Pagamento registrado");
      onDone();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao registrar pagamento");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Marcar como pago</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {order && (
            <div className="text-sm bg-muted/40 rounded-md p-3">
              <p className="font-medium">{order.beneficiario_nome}</p>
              <p className="text-muted-foreground text-xs">{order.descricao}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Valor pago *</Label>
              <CurrencyInput value={valor} onValueChange={setValor} />
            </div>
            <div className="space-y-1.5">
              <Label>Data *</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Forma de pagamento</Label>
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
          <div className="space-y-1.5">
            <Label>Comprovante (opcional)</Label>
            <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <p className="text-xs text-muted-foreground">PDF, JPG ou PNG até 10MB</p>
          </div>
          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Confirmar pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
