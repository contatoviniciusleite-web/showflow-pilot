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
import { EXPENSE_CATEGORIES, monthRefOf } from "@/lib/producerFinance";

type Expense = {
  id?: string;
  categoria: string;
  descricao: string;
  beneficiario: string | null;
  valor: number;
  data_vencimento: string | null;
  forma_pagamento: string | null;
  observacoes: string | null;
  mes_referencia?: string;
};

export function ExpenseDialog({
  open, onOpenChange, expense, onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  expense: Expense | null;
  onDone: () => void;
}) {
  const { user } = useAuth();
  const [categoria, setCategoria] = useState("outro");
  const [descricao, setDescricao] = useState("");
  const [beneficiario, setBeneficiario] = useState("");
  const [valor, setValor] = useState(0);
  const [vencimento, setVencimento] = useState(new Date().toISOString().slice(0, 10));
  const [forma, setForma] = useState("pix");
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setCategoria(expense?.categoria ?? "outro");
      setDescricao(expense?.descricao ?? "");
      setBeneficiario(expense?.beneficiario ?? "");
      setValor(expense?.valor ?? 0);
      setVencimento(expense?.data_vencimento ?? new Date().toISOString().slice(0, 10));
      setForma(expense?.forma_pagamento ?? "pix");
      setObs(expense?.observacoes ?? "");
    }
  }, [open, expense]);

  const submit = async () => {
    if (!descricao.trim()) return toast.error("Descrição é obrigatória");
    if (valor <= 0) return toast.error("Valor inválido");
    setSaving(true);
    try {
      const payload: any = {
        categoria, descricao,
        beneficiario: beneficiario || null,
        valor,
        data_vencimento: vencimento,
        forma_pagamento: forma || null,
        observacoes: obs || null,
        mes_referencia: monthRefOf(new Date(vencimento)),
      };
      if (expense?.id) {
        const { error } = await supabase.from("producer_expenses" as any).update(payload).eq("id", expense.id);
        if (error) throw error;
      } else {
        payload.created_by = user?.id ?? null;
        payload.status = "pendente";
        payload.recorrente = false;
        const { error } = await supabase.from("producer_expenses" as any).insert(payload);
        if (error) throw error;
      }
      toast.success("Despesa salva");
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
          <DialogTitle>{expense?.id ? "Editar despesa" : "Nova despesa avulsa"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Categoria</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.icon} {c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Vencimento</Label>
              <Input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
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
