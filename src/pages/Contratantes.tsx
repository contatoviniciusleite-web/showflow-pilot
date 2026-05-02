import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TitleCaseInput } from "@/components/ui/title-case-input";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, Users, Eye } from "lucide-react";
import { formatCEP, formatCpfCnpj, formatCurrencyBRL, formatPhoneBR } from "@/lib/masks";

interface Contratante {
  id: string;
  nome: string;
  documento: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  telefone: string | null;
  email: string | null;
  observacoes: string | null;
  created_at?: string;
}

interface HistShow {
  id: string;
  data_show: string;
  local: string | null;
  cidade: string | null;
  cache_total: number;
  status?: string | null;
  artists?: { nome: string } | null;
}

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  aprovada: "Aprovada",
  aguardando_comprovante: "Aguardando comprovante",
  comprovante_enviado: "Comprovante enviado",
  confirmada: "Confirmada",
  cancelada: "Cancelada",
  remarcada: "Remarcada",
};

const empty: Omit<Contratante, "id"> = {
  nome: "",
  documento: "",
  endereco: "",
  cidade: "",
  estado: "",
  cep: "",
  telefone: "",
  email: "",
  observacoes: "",
};

function fmtDate(d: string) {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

export default function Contratantes() {
  const { roles } = useAuth();
  const isManager = roles.includes("gerente");
  const isFin = roles.includes("financeiro");
  const isVendedor = roles.includes("vendedor");
  const isStaff = roles.includes("equipe");
  const canCreate = isManager || isFin || isVendedor || isStaff;
  const canEdit = isManager || isFin;
  const canDelete = isManager;

  const [items, setItems] = useState<Contratante[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Contratante | null>(null);
  const [form, setForm] = useState<Omit<Contratante, "id">>(empty);
  const [saving, setSaving] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<{ contratante: Contratante; shows: HistShow[] } | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("contratantes-admin", { body: { action: "list" } });
    if (error) toast.error(error.message);
    setItems((data?.contratantes ?? []) as Contratante[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((c) => c.nome.toLowerCase().includes(q) || (c.documento ?? "").includes(q));
  }, [items, search]);

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (c: Contratante) => {
    setEditing(c);
    setForm({
      nome: c.nome,
      documento: c.documento ?? "",
      endereco: c.endereco ?? "",
      cidade: c.cidade ?? "",
      estado: c.estado ?? "",
      cep: c.cep ?? "",
      telefone: c.telefone ?? "",
      email: c.email ?? "",
      observacoes: c.observacoes ?? "",
    });
    setOpen(true);
  };
  const openDetail = async (c: Contratante) => {
    const { data, error } = await supabase.functions.invoke("contratantes-admin", { body: { action: "get", id: c.id } });
    if (error) return toast.error(error.message);
    setDetail({ contratante: data.contratante, shows: data.shows ?? [] });
    setDetailOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim()) return toast.error("Nome é obrigatório");
    setSaving(true);
    try {
      const action = editing ? "update" : "create";
      const { error } = await supabase.functions.invoke("contratantes-admin", {
        body: editing ? { action, id: editing.id, contratante: form } : { action, contratante: form },
      });
      if (error) throw error;
      toast.success(editing ? "Contratante atualizado" : "Contratante cadastrado");
      setOpen(false);
      load();
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c: Contratante) => {
    if (!confirm(`Excluir ${c.nome}?`)) return;
    const { error } = await supabase.functions.invoke("contratantes-admin", { body: { action: "delete", id: c.id } });
    if (error) return toast.error(error.message);
    toast.success("Contratante excluído");
    load();
  };

  const setF = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold">Contratantes</h1>
          <p className="text-muted-foreground mt-1">{items.length} cadastrado(s)</p>
        </div>
        {canCreate && (
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Novo contratante</Button>
        )}
      </div>

      <div className="mb-4">
        <Input placeholder="Buscar por nome ou documento..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center shadow-soft">
          <Users className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground mb-4">Nenhum contratante {search ? "encontrado" : "cadastrado"}.</p>
          {canCreate && !search && <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Cadastrar primeiro</Button>}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((c) => (
            <Card key={c.id} className="p-4 shadow-soft">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold truncate">{c.nome}</h3>
                  {c.documento && <p className="text-xs text-muted-foreground mt-0.5">{formatCpfCnpj(c.documento)}</p>}
                  {(c.cidade || c.estado) && <p className="text-sm mt-1 truncate">{[c.cidade, c.estado].filter(Boolean).join(" / ")}</p>}
                  {c.telefone && <p className="text-xs text-muted-foreground mt-0.5">{formatPhoneBR(c.telefone)}</p>}
                  {c.email && <p className="text-xs text-muted-foreground truncate">{c.email}</p>}
                </div>
                <div className="flex flex-col gap-1">
                  <Button size="sm" variant="outline" onClick={() => openDetail(c)} title="Ver ficha"><Eye className="h-3.5 w-3.5" /></Button>
                  {canEdit && <Button size="sm" variant="outline" onClick={() => openEdit(c)} title="Editar"><Pencil className="h-3.5 w-3.5" /></Button>}
                  {canDelete && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(c)} title="Excluir"><Trash2 className="h-3.5 w-3.5" /></Button>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Cadastro / edição */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar contratante" : "Novo contratante"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Nome / Razão social *</Label>
                <TitleCaseInput value={form.nome} onValueChange={(v) => setF("nome", v)} required />
              </div>
              <div className="space-y-1.5">
                <Label>CPF / CNPJ</Label>
                <Input value={formatCpfCnpj(form.documento ?? "")} onChange={(e) => setF("documento", e.target.value.replace(/\D/g, ""))} />
              </div>
              <div className="space-y-1.5">
                <Label>CEP</Label>
                <Input value={formatCEP(form.cep ?? "")} onChange={(e) => setF("cep", e.target.value.replace(/\D/g, ""))} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Endereço</Label>
                <TitleCaseInput value={form.endereco ?? ""} onValueChange={(v) => setF("endereco", v)} />
              </div>
              <div className="space-y-1.5">
                <Label>Cidade</Label>
                <TitleCaseInput value={form.cidade ?? ""} onValueChange={(v) => setF("cidade", v)} />
              </div>
              <div className="space-y-1.5">
                <Label>Estado (UF)</Label>
                <Input maxLength={2} value={(form.estado ?? "").toUpperCase()} onChange={(e) => setF("estado", e.target.value.toUpperCase().slice(0, 2))} />
              </div>
              <div className="space-y-1.5">
                <Label>Telefone</Label>
                <Input value={formatPhoneBR(form.telefone ?? "")} onChange={(e) => setF("telefone", e.target.value.replace(/\D/g, ""))} />
              </div>
              <div className="space-y-1.5">
                <Label>E-mail</Label>
                <Input type="email" value={form.email ?? ""} onChange={(e) => setF("email", e.target.value)} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Observações</Label>
                <Textarea rows={3} value={form.observacoes ?? ""} onChange={(e) => setF("observacoes", e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editing ? "Salvar" : "Cadastrar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Ficha + histórico */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detail?.contratante.nome}</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                {detail.contratante.documento && <div><span className="text-muted-foreground">Documento: </span>{formatCpfCnpj(detail.contratante.documento)}</div>}
                {detail.contratante.telefone && <div><span className="text-muted-foreground">Telefone: </span>{formatPhoneBR(detail.contratante.telefone)}</div>}
                {detail.contratante.email && <div className="col-span-2"><span className="text-muted-foreground">E-mail: </span>{detail.contratante.email}</div>}
                {detail.contratante.endereco && <div className="col-span-2"><span className="text-muted-foreground">Endereço: </span>{detail.contratante.endereco}</div>}
                {(detail.contratante.cidade || detail.contratante.estado) && (
                  <div><span className="text-muted-foreground">Cidade/UF: </span>{[detail.contratante.cidade, detail.contratante.estado].filter(Boolean).join(" / ")}</div>
                )}
                {detail.contratante.cep && <div><span className="text-muted-foreground">CEP: </span>{formatCEP(detail.contratante.cep)}</div>}
                {detail.contratante.observacoes && <div className="col-span-2"><span className="text-muted-foreground">Obs.: </span>{detail.contratante.observacoes}</div>}
              </div>

              <div>
                <h4 className="font-semibold mb-2">Histórico de shows ({detail.shows.length})</h4>
                {detail.shows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum show vinculado.</p>
                ) : (
                  <div className="space-y-2">
                    {detail.shows.map((s) => (
                      <div key={s.id} className="text-sm border rounded-md p-2">
                        <div className="flex justify-between">
                          <span className="font-medium">{s.artists?.nome ?? "—"}</span>
                          <span className="text-muted-foreground">{fmtDate(s.data_show)}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">{s.local ?? "—"}{s.cidade ? ` — ${s.cidade}` : ""}</div>
                        <div className="text-xs font-medium">{formatCurrencyBRL(Number(s.cache_total ?? 0))}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
