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
import { EXPENSE_CATEGORIES_V2, getCategoria } from "@/lib/expenseCategories";

type Recurring = {
  id?: string;
  categoria: string;
  descricao: string;
  beneficiario: string | null;
  valor: number;
  dia_vencimento: number;
  forma_pagamento_padrao: string | null;
  observacoes: string | null;
  ativo: boolean;
};

export function RecurringExpenseDialog({
  open, onOpenChange, recurring, onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  recurring: Recurring | null;
  onDone: () => void;
}) {
  const [categoria, setCategoria] = useState("funcionamento");
  const [descricao, setDescricao] = useState("");
  const [beneficiario, setBeneficiario] = useState("");
  const [valor, setValor] = useState(0);
  const [dia, setDia] = useState(5);
  const [forma, setForma] = useState("pix");
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setCategoria(recurring?.categoria ?? "funcionamento");
      setDescricao(recurring?.descricao ?? "");
      setBeneficiario(recurring?.beneficiario ?? "");
      setValor(recurring?.valor ?? 0);
      setDia(recurring?.dia_vencimento ?? 5);
      setForma(recurring?.forma_pagamento_padrao ?? "pix");
      setObs(recurring?.observacoes ?? "");
    }
  }, [open, recurring]);

  const submit = async () => {
    if (!descricao.trim()) return toast.error("Descrição é obrigatória");
    if (valor <= 0) return toast.error("Valor inválido");
    if (dia < 1 || dia > 31) return toast.error("Dia inválido (1-31)");
    setSaving(true);
    try {
      const payload: any = {
        categoria, descricao,
        beneficiario: beneficiario || null,
        valor, dia_vencimento: dia,
        forma_pagamento_padrao: forma || null,
        observacoes: obs || null,
        ativo: true,
      };
      if (recurring?.id) {
        const { error } = await supabase.from("producer_recurring_expenses" as any).update(payload).eq("id", recurring.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("producer_recurring_expenses" as any).insert(payload);
        if (error) throw error;
      }
      toast.success("Despesa recorrente salva");
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
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{recurring?.id ? "Editar recorrente" : "Nova despesa recorrente"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Categoria</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES_V2.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.icon} {c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Dia do vencimento (1-31)</Label>
              <Input type="number" min={1} max={31} value={dia} onChange={(e) => setDia(Number(e.target.value))} />
            </div>
          </div>
          <div>
            <Label>Descrição</Label>
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Beneficiário</Label>
              <Input value={beneficiario} onChange={(e) => setBeneficiario(e.target.value)} />
            </div>
            <div>
              <Label>Valor</Label>
              <CurrencyInput value={valor} onValueChange={setValor} />
            </div>
          </div>
          <div>
            <Label>Forma de pagamento padrão</Label>
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
            <Label>Observações</Label>
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
