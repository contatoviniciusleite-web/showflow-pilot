import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Plus, Pencil, Power, FileText } from "lucide-react";
import { toast } from "sonner";

type Template = {
  id: string;
  name: string;
  content: string;
  is_active: boolean;
  created_at: string;
};

const VARIABLES: { key: string; label: string }[] = [
  { key: "nome_artista", label: "Nome do artista" },
  { key: "data_show", label: "Data do show" },
  { key: "horario_show", label: "Horário do show" },
  { key: "local_show", label: "Local do show" },
  { key: "cidade_show", label: "Cidade do show" },
  { key: "valor_cache", label: "Valor do cachê" },
  { key: "forma_pagamento", label: "Forma de pagamento" },
  { key: "valor_entrada", label: "Valor de entrada" },
  { key: "valor_saldo", label: "Valor do saldo" },
  { key: "nome_contratante", label: "Nome do contratante" },
  { key: "cnpj_contratante", label: "CNPJ do contratante" },
  { key: "nome_produtora", label: "Nome da produtora" },
  { key: "cnpj_produtora", label: "CNPJ da produtora" },
  { key: "data_geracao", label: "Data de geração" },
];

const templateSchema = z.object({
  name: z.string().trim().min(3, "Nome deve ter pelo menos 3 caracteres"),
  content: z.string().min(100, "Conteúdo deve ter pelo menos 100 caracteres"),
});

export default function ContractTemplates() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("contract_templates")
      .select("id, name, content, is_active, created_at")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows((data ?? []) as Template[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleNew = () => {
    setEditing(null);
    setName("");
    setContent("");
    setOpen(true);
  };

  const handleEdit = (t: Template) => {
    setEditing(t);
    setName(t.name);
    setContent(t.content);
    setOpen(true);
  };

  const handleToggleActive = async (t: Template) => {
    const { error } = await supabase
      .from("contract_templates")
      .update({ is_active: !t.is_active })
      .eq("id", t.id);
    if (error) return toast.error(error.message);
    toast.success(t.is_active ? "Template desativado" : "Template ativado");
    load();
  };

  const insertVariable = (key: string) => {
    const ta = textareaRef.current;
    const token = `{{${key}}}`;
    if (!ta) {
      setContent((c) => c + token);
      return;
    }
    const start = ta.selectionStart ?? content.length;
    const end = ta.selectionEnd ?? content.length;
    const next = content.slice(0, start) + token + content.slice(end);
    setContent(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + token.length;
      ta.setSelectionRange(pos, pos);
    });
  };

  const handleSave = async () => {
    const parsed = templateSchema.safeParse({ name, content });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    setSaving(true);
    if (editing) {
      const { error } = await supabase
        .from("contract_templates")
        .update({ name: parsed.data.name, content: parsed.data.content })
        .eq("id", editing.id);
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("Template atualizado");
    } else {
      const { error } = await supabase
        .from("contract_templates")
        .insert({ name: parsed.data.name, content: parsed.data.content, created_by: user?.id ?? null });
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("Template criado");
    }
    setOpen(false);
    load();
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold">Templates de Contrato</h1>
          <p className="text-muted-foreground mt-1">Modelos de contrato com variáveis dinâmicas para shows.</p>
        </div>
        <Button onClick={handleNew} className="bg-[hsl(var(--stage-green))] hover:bg-[hsl(var(--stage-green-deep))] text-black font-semibold">
          <Plus className="h-4 w-4 mr-2" />Novo template
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : rows.length === 0 ? (
        <Card className="p-12 text-center shadow-soft">
          <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground mb-4">Nenhum template cadastrado</p>
          <Button onClick={handleNew}><Plus className="h-4 w-4 mr-2" />Criar primeiro template</Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((t) => (
            <Card key={t.id} className="p-4 shadow-soft flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-medium truncate">{t.name}</h3>
                  <Badge variant={t.is_active ? "default" : "secondary"}>
                    {t.is_active ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Criado em {format(new Date(t.created_at), "dd/MM/yyyy", { locale: ptBR })}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" onClick={() => handleEdit(t)}>
                  <Pencil className="h-4 w-4 mr-1" />Editar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleToggleActive(t)}>
                  <Power className="h-4 w-4 mr-1" />{t.is_active ? "Desativar" : "Ativar"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar template" : "Novo template"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="tpl-name">Nome do template</Label>
              <Input
                id="tpl-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Contrato Padrão de Show"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_240px] gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="tpl-content">Conteúdo do contrato</Label>
                <Textarea
                  id="tpl-content"
                  ref={textareaRef}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Cole aqui o corpo do contrato. Use {{variavel}} para campos dinâmicos."
                  className="font-mono text-xs min-h-[400px]"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Variáveis disponíveis</Label>
                <Card className="p-2 max-h-[400px] overflow-y-auto space-y-1">
                  {VARIABLES.map((v) => (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => insertVariable(v.key)}
                      className="w-full text-left px-2 py-1.5 rounded-md hover:bg-muted text-xs transition-colors"
                    >
                      <code className="font-mono text-[11px] text-accent">{`{{${v.key}}}`}</code>
                      <p className="text-muted-foreground text-[11px]">{v.label}</p>
                    </button>
                  ))}
                </Card>
                <p className="text-[11px] text-muted-foreground">Clique em uma variável para inserir no cursor.</p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
