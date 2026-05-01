import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, FileText, Check, X, Upload, Eye, CheckCircle2 } from "lucide-react";
import { STATUS_CLASS, STATUS_LABEL } from "@/lib/showStatus";

interface ArtistLite { id: string; nome: string; cor: string; cache_minimo?: number; }
type ShowStatus = "pendente" | "aguardando_pagamento" | "comprovante_enviado" | "confirmado" | "cancelada" | "aprovada";
interface Show {
  id: string;
  artist_id: string;
  artist_nome?: string | null;
  artist_cor?: string | null;
  data_show: string;
  horario: string | null;
  data_subida: string | null;
  created_at: string;
  created_by: string | null;
  status: ShowStatus;
  vendedor: string | null;
  local: string | null;
  tipo_estrutura: "aberta" | "fechada" | null;
  endereco: string | null;
  cidade: string | null;
  capacidade: number | null;
  contratante_nome: string | null;
  contratante_documento: string | null;
  contratante_endereco: string | null;
  contratante_cidade: string | null;
  contratante_cep: string | null;
  contratante_telefone: string | null;
  contratante_email: string | null;
  cache_total: number;
  condicao_pagamento: string | null;
  encargos_extras: boolean;
  transp_onibus: boolean;
  transp_van: boolean;
  transp_aereo: boolean;
  transp_excesso_bagagem: boolean;
  transp_observacoes: string | null;
  hosp_diaria_alimentacao: boolean;
  hosp_hospedagem: boolean;
  hosp_traslado: boolean;
  camarins_rider: string | null;
  autorizado_por: string | null;
}
interface ShowPublic {
  id: string;
  artist_id: string;
  artist_nome: string | null;
  artist_cor: string | null;
  data_show: string;
  horario: string | null;
  local: string | null;
  cidade: string | null;
}

const emptyForm = {
  artist_id: "",
  data_show: "",
  horario: "",
  data_subida: "",
  vendedor: "",
  local: "",
  tipo_estrutura: "" as "" | "aberta" | "fechada",
  endereco: "",
  cidade: "",
  capacidade: "" as string,
  contratante_nome: "",
  contratante_documento: "",
  contratante_endereco: "",
  contratante_cidade: "",
  contratante_cep: "",
  contratante_telefone: "",
  contratante_email: "",
  cache_total: "" as string,
  condicao_pagamento: "",
  encargos_extras: false,
  transp_onibus: false,
  transp_van: false,
  transp_aereo: false,
  transp_excesso_bagagem: false,
  transp_observacoes: "",
  hosp_diaria_alimentacao: false,
  hosp_hospedagem: false,
  hosp_traslado: false,
  camarins_rider: "",
  autorizado_por: "Vitor D.",
};

type FormState = typeof emptyForm;

function fmtBRL(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtDate(d: string | null) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function StatusBadge({ status }: { status: string }) {
  const cls = (STATUS_CLASS as any)[status] ?? "bg-muted text-muted-foreground";
  const label = (STATUS_LABEL as any)[status] ?? status;
  return <Badge className={cls}>{label}</Badge>;
}

export default function Shows() {
  const { roles, user } = useAuth();
  const isManager = roles.includes("gerente");
  const isStaff = roles.includes("equipe");
  const isVendedor = roles.includes("vendedor");
  const isArtista = roles.includes("artista");
  const isFinanceiro = roles.includes("financeiro");
  const isEditor = isManager || isStaff;
  const canCreate = isManager || isStaff || isVendedor;

  const uploadComprovante = async (s: Show) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*,application/pdf";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${s.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("comprovantes").upload(path, file);
      if (upErr) return toast.error(upErr.message);
      const { error } = await supabase.functions.invoke("shows-admin", {
        body: { action: "upload_comprovante", id: s.id, path },
      });
      if (error) return toast.error(error.message);
      toast.success("Comprovante enviado");
      load();
    };
    input.click();
  };

  const viewComprovante = async (s: Show) => {
    const { data, error } = await supabase.functions.invoke("shows-admin", {
      body: { action: "comprovante_signed_url", id: s.id },
    });
    if (error) return toast.error(error.message);
    if (data?.url) window.open(data.url, "_blank");
  };

  const confirmPayment = async (s: Show) => {
    if (!confirm("Confirmar o pagamento do sinal deste show?")) return;
    const { error } = await supabase.functions.invoke("shows-admin", {
      body: { action: "confirm_payment", id: s.id },
    });
    if (error) return toast.error(error.message);
    toast.success("Pagamento confirmado");
    load();
  };


  const [shows, setShows] = useState<Show[]>([]);
  const [outras, setOutras] = useState<ShowPublic[]>([]);
  const [artists, setArtists] = useState<ArtistLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Show | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  // Rejeição
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<Show | null>(null);
  const [rejectMotivo, setRejectMotivo] = useState("");

  const load = async () => {
    setLoading(true);
    const [showsRes, artistsRes] = await Promise.all([
      supabase.functions.invoke("shows-admin", { body: { action: "list" } }),
      canCreate
        ? supabase.functions.invoke("shows-admin", { body: { action: "artists" } })
        : Promise.resolve({ data: { artists: [] }, error: null } as any),
    ]);
    if (showsRes.error) toast.error(showsRes.error.message);
    if (artistsRes.error) toast.error(artistsRes.error.message);
    setShows((showsRes.data?.shows ?? []) as Show[]);
    setOutras((showsRes.data?.outras_aprovadas ?? []) as ShowPublic[]);
    setArtists((artistsRes.data?.artists ?? []) as ArtistLite[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  // Pré-popula nova minuta a partir da agenda (?new=1&artist=...&data=...)
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get("new") !== "1") return;
    if (!artists.length) return; // espera carregar
    const artistId = searchParams.get("artist") ?? "";
    const data = searchParams.get("data") ?? "";
    setEditing(null);
    setForm({ ...emptyForm, artist_id: artistId, data_show: data });
    setOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete("new"); next.delete("artist"); next.delete("data");
    setSearchParams(next, { replace: true });
  }, [searchParams, artists.length]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };
  const openEdit = (s: Show) => {
    setEditing(s);
    setForm({
      artist_id: s.artist_id,
      data_show: s.data_show ?? "",
      horario: s.horario ? s.horario.slice(0, 5) : "",
      data_subida: s.data_subida ?? "",
      vendedor: s.vendedor ?? "",
      local: s.local ?? "",
      tipo_estrutura: (s.tipo_estrutura ?? "") as any,
      endereco: s.endereco ?? "",
      cidade: s.cidade ?? "",
      capacidade: s.capacidade?.toString() ?? "",
      contratante_nome: s.contratante_nome ?? "",
      contratante_documento: s.contratante_documento ?? "",
      contratante_endereco: s.contratante_endereco ?? "",
      contratante_cidade: s.contratante_cidade ?? "",
      contratante_cep: s.contratante_cep ?? "",
      contratante_telefone: s.contratante_telefone ?? "",
      contratante_email: s.contratante_email ?? "",
      cache_total: s.cache_total?.toString() ?? "",
      condicao_pagamento: s.condicao_pagamento ?? "",
      encargos_extras: !!s.encargos_extras,
      transp_onibus: !!s.transp_onibus,
      transp_van: !!s.transp_van,
      transp_aereo: !!s.transp_aereo,
      transp_excesso_bagagem: !!s.transp_excesso_bagagem,
      transp_observacoes: s.transp_observacoes ?? "",
      hosp_diaria_alimentacao: !!s.hosp_diaria_alimentacao,
      hosp_hospedagem: !!s.hosp_hospedagem,
      hosp_traslado: !!s.hosp_traslado,
      camarins_rider: s.camarins_rider ?? "",
      autorizado_por: s.autorizado_por ?? "Vitor D.",
    });
    setOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.artist_id) return toast.error("Selecione o artista");
    if (!form.data_show) return toast.error("Informe a data do show");
    setSaving(true);
    try {
      const payload = {
        ...form,
        capacidade: form.capacidade === "" ? null : Number(form.capacidade),
        cache_total: form.cache_total === "" ? 0 : Number(form.cache_total),
      };
      const action = editing ? "update" : "create";
      const { error } = await supabase.functions.invoke("shows-admin", {
        body: editing ? { action, id: editing.id, show: payload } : { action, show: payload },
      });
      if (error) throw error;
      toast.success(editing ? "Minuta atualizada" : "Minuta enviada para aprovação");
      setOpen(false);
      load();
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (s: Show) => {
    if (!confirm(`Excluir minuta de ${s.artist_nome ?? "show"}? Esta ação não pode ser desfeita.`)) return;
    const { error } = await supabase.functions.invoke("shows-admin", { body: { action: "delete", id: s.id } });
    if (error) return toast.error(error.message);
    toast.success("Minuta excluída");
    load();
  };

  const approve = async (s: Show) => {
    if (!confirm(`Aprovar minuta de ${s.artist_nome ?? "show"}?`)) return;
    const { error } = await supabase.functions.invoke("shows-admin", { body: { action: "approve", id: s.id } });
    if (error) return toast.error(error.message);
    toast.success("Minuta aprovada — vendedor notificado");
    load();
  };

  const openReject = (s: Show) => {
    setRejectTarget(s);
    setRejectMotivo("");
    setRejectOpen(true);
  };
  const confirmReject = async () => {
    if (!rejectTarget) return;
    if (!rejectMotivo.trim()) return toast.error("Informe o motivo da rejeição");
    const { error } = await supabase.functions.invoke("shows-admin", {
      body: { action: "reject", id: rejectTarget.id, motivo: rejectMotivo.trim() },
    });
    if (error) return toast.error(error.message);
    toast.success("Minuta rejeitada — vendedor notificado");
    setRejectOpen(false);
    setRejectTarget(null);
    load();
  };

  const upcoming = useMemo(
    () => shows.filter((s) => s.data_show >= new Date().toISOString().slice(0, 10)).length,
    [shows],
  );

  const titulo = isVendedor && !isEditor ? "Minhas minutas" : "Minutas de show";

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold">{titulo}</h1>
          <p className="text-muted-foreground mt-1">{shows.length} cadastrada(s) · {upcoming} futura(s)</p>
        </div>
        {canCreate && (
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-2" />
            Nova minuta
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : shows.length === 0 ? (
        <Card className="p-12 text-center shadow-soft">
          <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground mb-4">Nenhuma minuta cadastrada ainda.</p>
          {canCreate && <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Criar primeira minuta</Button>}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {shows.map((s) => (
            <Card key={s.id} className="p-5 shadow-soft">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.artist_cor ?? "#888" }} />
                    <h3 className="font-semibold truncate">{s.artist_nome ?? "—"}</h3>
                    <StatusBadge status={s.status} />
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {fmtDate(s.data_show)}{s.horario ? ` · ${s.horario.slice(0, 5)}` : ""}
                  </p>
                  <p className="text-sm mt-1 truncate">{s.local ?? "Local não informado"}{s.cidade ? ` — ${s.cidade}` : ""}</p>
                  <p className="text-sm font-medium mt-2">{fmtBRL(Number(s.cache_total ?? 0))}</p>
                  {s.contratante_nome && <p className="text-xs text-muted-foreground mt-1 truncate">Contratante: {s.contratante_nome}</p>}
                  {s.vendedor && <p className="text-xs text-muted-foreground mt-1 truncate">Vendedor: {s.vendedor}</p>}
                </div>
                <div className="flex flex-col gap-1">
                  {isManager && s.status === "pendente" && (
                    <>
                      <Button size="sm" variant="default" className="bg-green-600 hover:bg-green-700" onClick={() => approve(s)} title="Aprovar">
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => openReject(s)} title="Rejeitar">
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                  {(s.status === "aguardando_pagamento") && (s.created_by === user?.id || isEditor) && (
                    <Button size="sm" variant="outline" onClick={() => uploadComprovante(s)} title="Anexar comprovante">
                      <Upload className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {(s.status === "comprovante_enviado" || s.status === "confirmado") && (
                    <Button size="sm" variant="outline" onClick={() => viewComprovante(s)} title="Ver comprovante">
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {s.status === "comprovante_enviado" && (isManager || isFinanceiro) && (
                    <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => confirmPayment(s)} title="Confirmar pagamento">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {isEditor && (
                    <Button size="sm" variant="outline" onClick={() => openEdit(s)} title="Editar"><Pencil className="h-3.5 w-3.5" /></Button>
                  )}
                  {isManager && (
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => remove(s)} title="Excluir">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Vendedor: shows aprovados de outros vendedores (apenas data/horário/local) */}
      {isVendedor && !isEditor && outras.length > 0 && (
        <div className="mt-10">
          <h2 className="text-lg font-semibold mb-3">Shows aprovados (outros vendedores)</h2>
          <p className="text-xs text-muted-foreground mb-4">Apenas informações básicas: artista, data, horário e local.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {outras.map((s) => (
              <Card key={s.id} className="p-4 shadow-soft">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.artist_cor ?? "#888" }} />
                  <h3 className="font-medium truncate">{s.artist_nome ?? "—"}</h3>
                  <Badge className="bg-green-600 text-white ml-auto">Aprovada</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {fmtDate(s.data_show)}{s.horario ? ` · ${s.horario.slice(0, 5)}` : ""}
                </p>
                <p className="text-sm mt-1 truncate">{s.local ?? "—"}{s.cidade ? ` — ${s.cidade}` : ""}</p>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Modal de rejeição */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rejeitar minuta</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Ao rejeitar, a minuta será excluída e o vendedor receberá uma notificação com o motivo.
          </p>
          <div className="space-y-1.5">
            <Label>Motivo *</Label>
            <Textarea rows={4} value={rejectMotivo} onChange={(e) => setRejectMotivo(e.target.value)} placeholder="Explique por que esta minuta está sendo rejeitada..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmReject}>Rejeitar e excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar minuta" : "Nova minuta de show"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className="space-y-6">
            {/* 1. Identificação */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Identificação</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Artista *</Label>
                  <Select value={form.artist_id} onValueChange={(v) => set("artist_id", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione o artista" /></SelectTrigger>
                    <SelectContent>
                      {artists.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Data do show *</Label>
                  <Input type="date" value={form.data_show} onChange={(e) => set("data_show", e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Horário</Label>
                  <Input type="time" value={form.horario} onChange={(e) => set("horario", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground">Data de subida</Label>
                  <Input
                    value={editing ? new Date(editing.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "Será registrada automaticamente ao salvar"}
                    readOnly
                    disabled
                    className="bg-muted/50 cursor-not-allowed"
                  />
                  <p className="text-[11px] text-muted-foreground">Preenchida automaticamente no momento do cadastro — não editável.</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Vendedor responsável</Label>
                  <Input value={form.vendedor} onChange={(e) => set("vendedor", e.target.value)} />
                </div>
              </div>
            </section>

            {/* 2. Local */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Local do evento</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Nome do local</Label>
                  <Input value={form.local} onChange={(e) => set("local", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Tipo de estrutura</Label>
                  <Select value={form.tipo_estrutura} onValueChange={(v) => set("tipo_estrutura", v as any)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aberta">Aberta</SelectItem>
                      <SelectItem value="fechada">Fechada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Capacidade</Label>
                  <Input type="number" min={0} value={form.capacidade} onChange={(e) => set("capacidade", e.target.value)} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Endereço</Label>
                  <Input value={form.endereco} onChange={(e) => set("endereco", e.target.value)} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Cidade</Label>
                  <Input value={form.cidade} onChange={(e) => set("cidade", e.target.value)} />
                </div>
              </div>
            </section>

            {/* 3. Contratante */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Contratante</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Nome / Razão social</Label>
                  <Input value={form.contratante_nome} onChange={(e) => set("contratante_nome", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>CNPJ / CPF</Label>
                  <Input value={form.contratante_documento} onChange={(e) => set("contratante_documento", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>CEP</Label>
                  <Input value={form.contratante_cep} onChange={(e) => set("contratante_cep", e.target.value)} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Endereço</Label>
                  <Input value={form.contratante_endereco} onChange={(e) => set("contratante_endereco", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Cidade</Label>
                  <Input value={form.contratante_cidade} onChange={(e) => set("contratante_cidade", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Telefone</Label>
                  <Input value={form.contratante_telefone} onChange={(e) => set("contratante_telefone", e.target.value)} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>E-mail</Label>
                  <Input type="email" value={form.contratante_email} onChange={(e) => set("contratante_email", e.target.value)} />
                </div>
              </div>
            </section>

            {/* 4. Cachê */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Cachê e pagamento</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Cachê total (R$)</Label>
                  <Input type="number" min={0} step="0.01" value={form.cache_total} onChange={(e) => set("cache_total", e.target.value)} />
                </div>
                <div className="flex items-center justify-between rounded-md border px-3 py-2 sm:mt-6">
                  <Label htmlFor="encargos" className="cursor-pointer text-sm">Encargos extras por conta do contratante</Label>
                  <Switch id="encargos" checked={form.encargos_extras} onCheckedChange={(v) => set("encargos_extras", v)} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Condição de pagamento</Label>
                  <Textarea rows={3} value={form.condicao_pagamento} onChange={(e) => set("condicao_pagamento", e.target.value)} placeholder="Ex: 50% sinal na assinatura, 50% até 24h antes do show via PIX..." />
                </div>
              </div>
            </section>

            {/* 5. Transporte */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Transporte</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  ["transp_onibus", "Ônibus"],
                  ["transp_van", "Van"],
                  ["transp_aereo", "Aéreo"],
                  ["transp_excesso_bagagem", "Excesso de bagagem"],
                ].map(([k, label]) => (
                  <label key={k} className="flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer">
                    <Checkbox checked={(form as any)[k]} onCheckedChange={(v) => set(k as any, !!v)} />
                    <span className="text-sm">{label}</span>
                  </label>
                ))}
                <div className="space-y-1.5 col-span-2">
                  <Label>Observações de transporte</Label>
                  <Textarea rows={2} value={form.transp_observacoes} onChange={(e) => set("transp_observacoes", e.target.value)} />
                </div>
              </div>
            </section>

            {/* 6. Hospedagem */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Hospedagem</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  ["hosp_diaria_alimentacao", "Diária + alimentação"],
                  ["hosp_hospedagem", "Hospedagem"],
                  ["hosp_traslado", "Traslado"],
                ].map(([k, label]) => (
                  <label key={k} className="flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer">
                    <Checkbox checked={(form as any)[k]} onCheckedChange={(v) => set(k as any, !!v)} />
                    <span className="text-sm">{label}</span>
                  </label>
                ))}
              </div>
            </section>

            {/* 7. Camarins / Rider */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Camarins / Rider técnico</h3>
              <Textarea rows={4} value={form.camarins_rider} onChange={(e) => set("camarins_rider", e.target.value)} placeholder="Detalhes técnicos, exigências de camarim, alimentação, etc." />
            </section>

            {/* 8. Autorização */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Autorização</h3>
              <div className="space-y-1.5">
                <Label>Autorizado por</Label>
                <Input value={form.autorizado_por} onChange={(e) => set("autorizado_por", e.target.value)} />
              </div>
            </section>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editing ? "Salvar alterações" : "Cadastrar minuta"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
