import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export type FornecedorFormData = {
  id?: string;
  nome: string;
  tipo: string;
  telefone: string;
  chave_pix: string;
  banco: string;
  agencia: string;
  conta: string;
  observacoes: string;
  ativo: boolean;
};

const TIPOS = ["Van", "Equipamento", "Efeitos", "Outros"];

const empty: FornecedorFormData = {
  nome: "", tipo: "Outros", telefone: "", chave_pix: "",
  banco: "", agencia: "", conta: "", observacoes: "", ativo: true,
};

export function FornecedorDialog({
  open, onOpenChange, fornecedor, onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  fornecedor: FornecedorFormData | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FornecedorFormData>(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setForm(fornecedor ?? empty); }, [open, fornecedor]);

  const submit = async () => {
    if (!form.nome.trim()) return toast.error("Nome é obrigatório");
    setSaving(true);
    const payload = {
      nome: form.nome.trim(),
      tipo: form.tipo,
      telefone: form.telefone || null,
      chave_pix: form.chave_pix || null,
      banco: form.banco || null,
      agencia: form.agencia || null,
      conta: form.conta || null,
      observacoes: form.observacoes || null,
      ativo: form.ativo,
    };
    const res = form.id
      ? await supabase.from("fornecedores").update(payload).eq("id", form.id)
      : await supabase.from("fornecedores").insert(payload);
    setSaving(false);
    if (res.error) return toast.error(res.error.message);
    toast.success(form.id ? "Fornecedor atualizado" : "Fornecedor cadastrado");
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{form.id ? "Editar fornecedor" : "Novo fornecedor"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1.5">
            <Label>Nome *</Label>
            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Telefone</Label>
            <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Chave PIX</Label>
            <Input value={form.chave_pix} onChange={(e) => setForm({ ...form, chave_pix: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Banco</Label>
            <Input value={form.banco} onChange={(e) => setForm({ ...form, banco: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Agência</Label>
            <Input value={form.agencia} onChange={(e) => setForm({ ...form, agencia: e.target.value })} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Conta</Label>
            <Input value={form.conta} onChange={(e) => setForm({ ...form, conta: e.target.value })} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Observações</Label>
            <Textarea rows={3} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
          </div>
          <div className="col-span-2 flex items-center gap-2">
            <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
            <Label>Ativo</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
