import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Pencil, Trash2, Building2 } from "lucide-react";
import { toast } from "sonner";
import { FornecedorDialog, type FornecedorFormData } from "@/components/fornecedores/FornecedorDialog";

type Fornecedor = {
  id: string; nome: string; tipo: string; telefone: string | null;
  chave_pix: string | null; banco: string | null; agencia: string | null; conta: string | null;
  observacoes: string | null; ativo: boolean;
};

export default function Fornecedores() {
  const [rows, setRows] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filterTipo, setFilterTipo] = useState("__all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FornecedorFormData | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("fornecedores").select("*").order("nome");
    if (error) toast.error(error.message);
    setRows((data ?? []) as any);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = rows.filter((r) => {
    if (filterTipo !== "__all" && r.tipo !== filterTipo) return false;
    if (busca && !r.nome.toLowerCase().includes(busca.toLowerCase())) return false;
    return true;
  });

  const handleEdit = (r: Fornecedor) => {
    setEditing({
      id: r.id, nome: r.nome, tipo: r.tipo, telefone: r.telefone ?? "",
      chave_pix: r.chave_pix ?? "", banco: r.banco ?? "", agencia: r.agencia ?? "",
      conta: r.conta ?? "", observacoes: r.observacoes ?? "", ativo: r.ativo,
    });
    setOpen(true);
  };
  const handleNew = () => { setEditing(null); setOpen(true); };
  const handleDelete = async (r: Fornecedor) => {
    if (!confirm(`Excluir fornecedor "${r.nome}"?`)) return;
    const { error } = await supabase.from("fornecedores").delete().eq("id", r.id);
    if (error) toast.error(error.message);
    else { toast.success("Fornecedor excluído"); load(); }
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold">Fornecedores</h1>
          <p className="text-muted-foreground mt-1">Cadastro de fornecedores para despesas e ordens de pagamento.</p>
        </div>
        <Button onClick={handleNew} className="bg-[hsl(var(--stage-green))] hover:bg-[hsl(var(--stage-green-deep))] text-black font-semibold">
          <Plus className="h-4 w-4 mr-2" />Novo fornecedor
        </Button>
      </div>

      <Card className="p-4 mb-4 grid grid-cols-1 md:grid-cols-3 gap-3 shadow-soft">
        <div className="space-y-1.5 md:col-span-2">
          <Label>Buscar</Label>
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome do fornecedor" />
        </div>
        <div className="space-y-1.5">
          <Label>Tipo</Label>
          <Select value={filterTipo} onValueChange={setFilterTipo}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todos</SelectItem>
              <SelectItem value="Van">Van</SelectItem>
              <SelectItem value="Equipamento">Equipamento</SelectItem>
              <SelectItem value="Efeitos">Efeitos</SelectItem>
              <SelectItem value="Outros">Outros</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center shadow-soft">
          <Building2 className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground mb-4">Nenhum fornecedor encontrado.</p>
          <Button onClick={handleNew}><Plus className="h-4 w-4 mr-2" />Cadastrar fornecedor</Button>
        </Card>
      ) : (
        <Card className="shadow-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium">Nome</th>
                  <th className="px-3 py-2 font-medium">Tipo</th>
                  <th className="px-3 py-2 font-medium">Telefone</th>
                  <th className="px-3 py-2 font-medium">PIX</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium">{r.nome}</td>
                    <td className="px-3 py-2">{r.tipo}</td>
                    <td className="px-3 py-2">{r.telefone || "—"}</td>
                    <td className="px-3 py-2 truncate max-w-[200px]">{r.chave_pix || "—"}</td>
                    <td className="px-3 py-2">
                      <Badge variant={r.ativo ? "default" : "secondary"}>{r.ativo ? "Ativo" : "Inativo"}</Badge>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEdit(r)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDelete(r)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <FornecedorDialog open={open} onOpenChange={setOpen} fornecedor={editing} onSaved={load} />
    </div>
  );
}
