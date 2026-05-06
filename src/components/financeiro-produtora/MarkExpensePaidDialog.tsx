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

type ExpenseRow = {
  id: string;
  valor: number;
  descricao: string;
  forma_pagamento: string | null;
};

export function MarkExpensePaidDialog({
  open, onOpenChange, expense, onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  expense: ExpenseRow | null;
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
    if (expense) {
      setValor(expense.valor);
      setForma(expense.forma_pagamento ?? "pix");
      setObs(""); setFile(null);
      setData(new Date().toISOString().slice(0, 10));
    }
  }, [expense]);

  const submit = async () => {
    if (!expense) return;
    setSaving(true);
    try {
      let path: string | null = null;
      if (file) {
        if (file.size > 10 * 1024 * 1024) throw new Error("Arquivo maior que 10MB");
        const ext = file.name.split(".").pop();
        const p = `despesas/${expense.id}/${Date.now()}.${ext}`;
        const up = await supabase.storage.from("financeiro-produtora").upload(p, file);
        if (up.error) throw up.error;
        path = p;
      }
      const { error } = await supabase.from("producer_expenses" as any).update({
        status: "pago",
        valor_pago: valor,
        data_vencimento: undefined,
        forma_pagamento: forma,
        pago_por: user?.id ?? null,
        pago_em: new Date().toISOString(),
        observacoes: obs || null,
        ...(path ? { comprovante_path: path } : {}),
      }).eq("id", expense.id);
      if (error) throw error;

      // Atualiza data_pagamento via update separado já que coluna não existe; usaremos pago_em.
      toast.success("Despesa marcada como paga");
      onDone();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Erro");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Marcar despesa como paga</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">{expense?.descricao}</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Valor pago</Label>
              <CurrencyInput value={valor} onValueChange={setValor} />
            </div>
            <div>
              <Label>Data</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Forma de pagamento</Label>
            <Select value={forma} onValueChange={setForma}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="ted">TED</SelectItem>
                <SelectItem value="boleto">Boleto</SelectItem>
                <SelectItem value="dinheiro">Dinheiro</SelectItem>
                <SelectItem value="cartao">Cartão</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Comprovante (opcional)</Label>
            <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Confirmar pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
