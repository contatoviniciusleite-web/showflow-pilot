import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, Upload } from "lucide-react";
import { z } from "zod";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { FinancialConfigTab } from "@/components/artists/FinancialConfigTab";

interface Artist {
  id: string;
  nome: string;
  foto_url: string | null;
  google_calendar_id: string | null;
  rider_padrao: string | null;
  cor: string;
  ativo: boolean;
  cache_minimo: number;
}

const schema = z.object({
  nome: z.string().trim().min(1, "Nome obrigatório").max(120),
  google_calendar_id: z.string().trim().max(255).optional().or(z.literal("")),
  rider_padrao: z.string().max(5000).optional().or(z.literal("")),
  cor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor em hex (#RRGGBB)"),
  ativo: z.boolean(),
  cache_minimo: z.number().min(0),
});

const PRESET_COLORS = ["#f59e0b", "#ef4444", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899"];

function ArtistAvatar({ artist }: { artist: Artist }) {
  const [signed, setSigned] = useState<string | null>(null);
  useEffect(() => {
    if (!artist.foto_url) return;
    supabase.storage.from("artists").createSignedUrl(artist.foto_url, 3600).then(({ data }) => {
      if (data?.signedUrl) setSigned(data.signedUrl);
    });
  }, [artist.foto_url]);
  return (
    <Avatar className="h-12 w-12 border" style={{ borderColor: artist.cor }}>
      {signed && <AvatarImage src={signed} alt={artist.nome} />}
      <AvatarFallback style={{ backgroundColor: artist.cor + "33", color: artist.cor }}>
        {artist.nome.slice(0, 2).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );
}

export default function Artistas() {
  const { roles } = useAuth();
  const canFinancialConfig = roles.includes("diretor") || roles.includes("gerente");
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Artist | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    nome: "",
    google_calendar_id: "",
    rider_padrao: "",
    cor: "#f59e0b",
    ativo: true,
    cache_minimo: 0,
    fotoFile: null as File | null,
  });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("artists-admin", {
      body: { action: "list" },
    });
    if (error) toast.error(error.message);
    setArtists((data?.artists ?? []) as Artist[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ nome: "", google_calendar_id: "", rider_padrao: "", cor: "#f59e0b", ativo: true, cache_minimo: 0, fotoFile: null });
    setOpen(true);
  };
  const openEdit = (a: Artist) => {
    setEditing(a);
    setForm({
      nome: a.nome,
      google_calendar_id: a.google_calendar_id ?? "",
      rider_padrao: a.rider_padrao ?? "",
      cor: a.cor,
      ativo: a.ativo,
      cache_minimo: Number(a.cache_minimo ?? 0),
      fotoFile: null,
    });
    setOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({
      nome: form.nome,
      google_calendar_id: form.google_calendar_id,
      rider_padrao: form.rider_padrao,
      cor: form.cor,
      ativo: form.ativo,
      cache_minimo: form.cache_minimo,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSaving(true);
    try {
      let foto_url = editing?.foto_url ?? null;
      if (form.fotoFile) {
        const ext = form.fotoFile.name.split(".").pop();
        const path = `${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("artists").upload(path, form.fotoFile);
        if (upErr) throw upErr;
        foto_url = path;
      }
      const payload = {
        nome: form.nome.trim(),
        google_calendar_id: form.google_calendar_id.trim() || null,
        rider_padrao: form.rider_padrao,
        cor: form.cor,
        ativo: form.ativo,
        cache_minimo: form.cache_minimo,
        foto_url,
      };
      if (editing) {
        const { error } = await supabase.functions.invoke("artists-admin", {
          body: { action: "update", id: editing.id, artist: payload },
        });
        if (error) throw error;
        toast.success("Artista atualizado");
      } else {
        const { error } = await supabase.functions.invoke("artists-admin", {
          body: { action: "create", artist: payload },
        });
        if (error) throw error;
        toast.success("Artista criado");
      }
      setOpen(false);
      load();
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (a: Artist) => {
    if (!confirm(`Remover ${a.nome}? Esta ação não pode ser desfeita.`)) return;
    const { error } = await supabase.functions.invoke("artists-admin", {
      body: { action: "delete", id: a.id },
    });
    if (error) return toast.error(error.message);
    toast.success("Artista removido");
    load();
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold">Artistas</h1>
          <p className="text-muted-foreground mt-1">Cadastro base dos artistas da produtora.</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" />
          Novo artista
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : artists.length === 0 ? (
        <Card className="p-12 text-center shadow-soft">
          <p className="text-muted-foreground mb-4">Nenhum artista cadastrado ainda.</p>
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Cadastrar primeiro artista</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {artists.map((a) => (
            <Card key={a.id} className="p-5 shadow-soft">
              <div className="flex items-start gap-4">
                <ArtistAvatar artist={a} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold truncate">{a.nome}</h3>
                    {!a.ativo && <span className="text-[10px] uppercase tracking-wider text-muted-foreground">inativo</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {a.google_calendar_id ?? "Sem Google Calendar"}
                  </p>
                  {a.rider_padrao && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{a.rider_padrao}</p>}
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button size="sm" variant="outline" onClick={() => openEdit(a)}><Pencil className="h-3.5 w-3.5 mr-1" />Editar</Button>
                <Button size="sm" variant="ghost" onClick={() => remove(a)} className="text-destructive hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar artista" : "Novo artista"}</DialogTitle>
          </DialogHeader>
          {editing && canFinancialConfig ? (
            <Tabs defaultValue="dados" className="w-full">
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="dados">Dados gerais</TabsTrigger>
                <TabsTrigger value="financeiro">Configuração financeira</TabsTrigger>
              </TabsList>
              <TabsContent value="dados" className="pt-4">
                <ArtistForm
                  form={form}
                  setForm={setForm}
                  save={save}
                  saving={saving}
                  onCancel={() => setOpen(false)}
                />
              </TabsContent>
              <TabsContent value="financeiro" className="pt-4">
                <FinancialConfigTab artistId={editing.id} artistName={editing.nome} />
              </TabsContent>
            </Tabs>
          ) : (
            <ArtistForm
              form={form}
              setForm={setForm}
              save={save}
              saving={saving}
              onCancel={() => setOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

type FormState = {
  nome: string;
  google_calendar_id: string;
  rider_padrao: string;
  cor: string;
  ativo: boolean;
  cache_minimo: number;
  fotoFile: File | null;
};

function ArtistForm({
  form,
  setForm,
  save,
  saving,
  onCancel,
}: {
  form: FormState;
  setForm: (f: FormState) => void;
  save: (e: React.FormEvent) => void;
  saving: boolean;
  onCancel: () => void;
}) {
  return (
    <form onSubmit={save} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="nome">Nome *</Label>
        <Input id="nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="foto">Foto</Label>
        <div className="flex items-center gap-2">
          <Input id="foto" type="file" accept="image/*" onChange={(e) => setForm({ ...form, fotoFile: e.target.files?.[0] ?? null })} />
          <Upload className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cal">ID do Google Calendar</Label>
        <Input id="cal" placeholder="exemplo@group.calendar.google.com" value={form.google_calendar_id} onChange={(e) => setForm({ ...form, google_calendar_id: e.target.value })} />
        <p className="text-xs text-muted-foreground">Pegue em Configurações do calendário → Integrar → ID do calendário.</p>
      </div>
      <div className="space-y-1.5">
        <Label>Cor (na agenda)</Label>
        <div className="flex items-center gap-2 flex-wrap">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setForm({ ...form, cor: c })}
              className="h-8 w-8 rounded-full border-2 transition"
              style={{ backgroundColor: c, borderColor: form.cor === c ? "hsl(var(--foreground))" : "transparent" }}
              aria-label={c}
            />
          ))}
          <Input type="color" value={form.cor} onChange={(e) => setForm({ ...form, cor: e.target.value })} className="h-8 w-16 p-1" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="rider">Rider padrão de hospitalidade</Label>
        <Textarea id="rider" rows={5} value={form.rider_padrao} onChange={(e) => setForm({ ...form, rider_padrao: e.target.value })} placeholder="Ex: 12 águas sem gás, 6 isotônicos, frutas frescas..." />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cmin">Cachê mínimo (R$)</Label>
        <Input id="cmin" type="number" min={0} step={100} value={form.cache_minimo} onChange={(e) => setForm({ ...form, cache_minimo: Number(e.target.value) || 0 })} />
        <p className="text-xs text-muted-foreground">Vendedores não conseguirão criar minutas abaixo deste valor. Use 0 para desativar.</p>
      </div>
      <div className="flex items-center justify-between rounded-md border px-3 py-2">
        <Label htmlFor="ativo" className="cursor-pointer">Artista ativo</Label>
        <Switch id="ativo" checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
      </div>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Salvar
        </Button>
      </DialogFooter>
    </form>
  );
}
