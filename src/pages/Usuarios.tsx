import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Pencil, Trash2, Mail, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth, AppRole } from "@/contexts/AuthContext";

interface RoleEntry {
  role: AppRole;
  artist_id: string | null;
}
interface AppUser {
  id: string;
  nome: string | null;
  email: string | null;
  last_sign_in_at: string | null;
  pendente: boolean;
  roles: RoleEntry[];
  vendedor_artist_ids: string[];
}
interface Artist {
  id: string;
  nome: string;
}

const ROLE_LABEL: Record<AppRole, string> = {
  diretor: "Diretor",
  gerente: "Gerente",
  equipe: "Equipe",
  artista: "Artista",
  vendedor: "Vendedor",
  financeiro: "Financeiro",
  socio: "Sócio",
};
const ALL_ROLES: AppRole[] = ["diretor", "gerente", "equipe", "artista", "vendedor", "financeiro", "socio"];

async function getFunctionErrorMessage(error: unknown, fallback = "Erro ao processar solicitação") {
  const err = error as { message?: string; context?: unknown } | null;
  const response = err?.context;
  if (response instanceof Response) {
    try {
      const data = await response.clone().json();
      if (typeof data?.error === "string" && data.error.trim()) return data.error;
    } catch {
      // Keep the generic message when the response body is not JSON.
    }
  }
  return err?.message ?? fallback;
}

export default function Usuarios() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ nome: "", email: "", role: "vendedor" as AppRole, artist_id: "", vendedor_artist_ids: [] as string[] });
  const [saving, setSaving] = useState(false);

  const [editing, setEditing] = useState<AppUser | null>(null);
  const [editForm, setEditForm] = useState({ nome: "", roles: [] as RoleEntry[], vendedor_artist_ids: [] as string[] });

  const load = async () => {
    setLoading(true);
    const [{ data: uData, error: uErr }, { data: aData, error: aErr }] = await Promise.all([
      supabase.functions.invoke("users-admin", { body: { action: "list" } }),
      supabase.functions.invoke("artists-admin", { body: { action: "list" } }),
    ]);
    if (uErr) toast.error(await getFunctionErrorMessage(uErr));
    if (aErr) toast.error(await getFunctionErrorMessage(aErr));
    setUsers((uData?.users ?? []) as AppUser[]);
    setArtists(((aData?.artists ?? []) as Artist[]).map((a) => ({ id: a.id, nome: a.nome })));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const artistName = (id: string | null) => artists.find((a) => a.id === id)?.nome ?? "—";

  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteForm.nome.trim() || !inviteForm.email.trim()) return toast.error("Preencha nome e e-mail");
    if (inviteForm.role === "artista" && !inviteForm.artist_id) return toast.error("Selecione o artista vinculado");
    setSaving(true);
    const { error } = await supabase.functions.invoke("users-admin", {
      body: {
        action: "invite",
        nome: inviteForm.nome.trim(),
        email: inviteForm.email.trim().toLowerCase(),
        role: inviteForm.role,
        artist_id: inviteForm.role === "artista" ? inviteForm.artist_id : null,
        vendedor_artist_ids: inviteForm.role === "vendedor" ? inviteForm.vendedor_artist_ids : [],
      },
    });
    setSaving(false);
    if (error) return toast.error(await getFunctionErrorMessage(error, "Erro ao enviar convite"));
    toast.success("Convite enviado");
    setInviteOpen(false);
    setInviteForm({ nome: "", email: "", role: "vendedor", artist_id: "", vendedor_artist_ids: [] });
    load();
  };

  const openEdit = (u: AppUser) => {
    setEditing(u);
    setEditForm({ nome: u.nome ?? "", roles: u.roles.length ? [...u.roles] : [], vendedor_artist_ids: [...(u.vendedor_artist_ids ?? [])] });
  };

  const addRole = () => {
    const used = new Set(editForm.roles.map((r) => r.role));
    const next = ALL_ROLES.find((r) => !used.has(r));
    if (!next) return;
    setEditForm({ ...editForm, roles: [...editForm.roles, { role: next, artist_id: null }] });
  };

  const updateRoleAt = (idx: number, patch: Partial<RoleEntry>) => {
    const next = editForm.roles.map((r, i) => (i === idx ? { ...r, ...patch } : r));
    setEditForm({ ...editForm, roles: next });
  };
  const removeRoleAt = (idx: number) => {
    setEditForm({ ...editForm, roles: editForm.roles.filter((_, i) => i !== idx) });
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (!editForm.nome.trim()) return toast.error("Nome obrigatório");
    for (const r of editForm.roles) {
      if (r.role === "artista" && !r.artist_id) return toast.error("Selecione o artista para o papel Artista");
    }
    setSaving(true);
    try {
      const { error: e1 } = await supabase.functions.invoke("users-admin", {
        body: { action: "update_profile", user_id: editing.id, nome: editForm.nome.trim() },
      });
      if (e1) throw e1;
      const { error: e2 } = await supabase.functions.invoke("users-admin", {
        body: {
          action: "set_roles",
          user_id: editing.id,
          roles: editForm.roles,
          vendedor_artist_ids: editForm.roles.some((r) => r.role === "vendedor") ? editForm.vendedor_artist_ids : [],
        },
      });
      if (e2) throw e2;
      toast.success("Usuário atualizado");
      setEditing(null);
      load();
    } catch (err: any) {
      toast.error(await getFunctionErrorMessage(err, "Erro ao salvar"));
    } finally {
      setSaving(false);
    }
  };

  const resend = async (u: AppUser) => {
    if (!u.email) return;
    const { error } = await supabase.functions.invoke("users-admin", {
      body: { action: "resend_invite", email: u.email },
    });
    if (error) return toast.error(await getFunctionErrorMessage(error, "Erro ao reenviar convite"));
    toast.success("Convite reenviado");
  };

  const remove = async (u: AppUser) => {
    if (u.id === me?.id) return toast.error("Você não pode remover a si mesmo");
    if (!confirm(`Remover ${u.nome ?? u.email}? Esta ação não pode ser desfeita.`)) return;
    const { error } = await supabase.functions.invoke("users-admin", {
      body: { action: "delete", user_id: u.id },
    });
    if (error) return toast.error(await getFunctionErrorMessage(error, "Erro ao remover usuário"));
    toast.success("Usuário removido");
    load();
  };

  const availableRolesFor = (idx: number) => {
    const used = new Set(editForm.roles.map((r, i) => (i === idx ? null : r.role)));
    return ALL_ROLES.filter((r) => !used.has(r));
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold">Usuários</h1>
          <p className="text-muted-foreground mt-1">Convide e gerencie quem tem acesso ao Stage.</p>
        </div>
        <Button onClick={() => setInviteOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />Convidar usuário
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <Card className="shadow-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-4 py-3">Nome</th>
                  <th className="text-left font-medium px-4 py-3">E-mail</th>
                  <th className="text-left font-medium px-4 py-3">Papéis</th>
                  <th className="text-left font-medium px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t">
                    <td className="px-4 py-3">{u.nome ?? "—"}{u.id === me?.id && <span className="text-xs text-muted-foreground ml-2">(você)</span>}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {u.roles.length === 0 && <span className="text-xs text-muted-foreground">sem papel</span>}
                        {u.roles.map((r, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {ROLE_LABEL[r.role]}
                            {r.role === "artista" && r.artist_id && ` · ${artistName(r.artist_id)}`}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {u.pendente ? (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                          <Mail className="h-3.5 w-3.5" /> Convite pendente
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                          <MailCheck className="h-3.5 w-3.5" /> Ativo
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {u.pendente && u.email && (
                          <Button size="sm" variant="ghost" onClick={() => resend(u)} title="Reenviar convite">
                            <Mail className="h-4 w-4" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => openEdit(u)} title="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => remove(u)} className="text-destructive hover:text-destructive" title="Remover">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Nenhum usuário cadastrado.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Convidar usuário</DialogTitle></DialogHeader>
          <form onSubmit={sendInvite} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="i-nome">Nome *</Label>
              <Input id="i-nome" value={inviteForm.nome} onChange={(e) => setInviteForm({ ...inviteForm, nome: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="i-email">E-mail *</Label>
              <Input id="i-email" type="email" value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label>Papel *</Label>
              <Select value={inviteForm.role} onValueChange={(v: AppRole) => setInviteForm({ ...inviteForm, role: v, artist_id: "" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ALL_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {inviteForm.role === "artista" && (
              <div className="space-y-1.5">
                <Label>Artista vinculado *</Label>
                <Select value={inviteForm.artist_id} onValueChange={(v) => setInviteForm({ ...inviteForm, artist_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione o artista" /></SelectTrigger>
                  <SelectContent>
                    {artists.map((a) => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {inviteForm.role === "vendedor" && (
              <div className="space-y-1.5">
                <Label>Artistas que pode vender</Label>
                <div className="border rounded-md p-2 max-h-48 overflow-y-auto space-y-1">
                  {artists.length === 0 && <p className="text-xs text-muted-foreground">Nenhum artista cadastrado.</p>}
                  {artists.map((a) => {
                    const checked = inviteForm.vendedor_artist_ids.includes(a.id);
                    return (
                      <label key={a.id} className="flex items-center gap-2 py-1 cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...inviteForm.vendedor_artist_ids, a.id]
                              : inviteForm.vendedor_artist_ids.filter((x) => x !== a.id);
                            setInviteForm({ ...inviteForm, vendedor_artist_ids: next });
                          }}
                        />
                        {a.nome}
                      </label>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">O vendedor só verá a agenda e poderá vender shows dos artistas marcados.</p>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Um e-mail será enviado com um link para a pessoa definir a própria senha.
            </p>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setInviteOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Enviar convite
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Editar usuário</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="e-nome">Nome</Label>
                <Input id="e-nome" value={editForm.nome} onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>E-mail</Label>
                <Input value={editing.email ?? ""} disabled />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Papéis</Label>
                  <Button type="button" size="sm" variant="outline" onClick={addRole} disabled={editForm.roles.length >= 4}>
                    <Plus className="h-3.5 w-3.5 mr-1" />Adicionar
                  </Button>
                </div>
                {editForm.roles.length === 0 && <p className="text-xs text-muted-foreground">Sem papéis. Adicione pelo menos um.</p>}
                {editForm.roles.map((r, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Select value={r.role} onValueChange={(v: AppRole) => updateRoleAt(i, { role: v, artist_id: v === "artista" ? r.artist_id : null })}>
                      <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {availableRolesFor(i).map((opt) => <SelectItem key={opt} value={opt}>{ROLE_LABEL[opt]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {r.role === "artista" && (
                      <Select value={r.artist_id ?? ""} onValueChange={(v) => updateRoleAt(i, { artist_id: v })}>
                        <SelectTrigger className="flex-1"><SelectValue placeholder="Artista" /></SelectTrigger>
                        <SelectContent>
                          {artists.map((a) => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                    <Button type="button" size="sm" variant="ghost" onClick={() => removeRoleAt(i)} className="text-destructive hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
              {editForm.roles.some((r) => r.role === "vendedor") && (
                <div className="space-y-1.5">
                  <Label>Artistas que pode vender</Label>
                  <div className="border rounded-md p-2 max-h-48 overflow-y-auto space-y-1">
                    {artists.length === 0 && <p className="text-xs text-muted-foreground">Nenhum artista cadastrado.</p>}
                    {artists.map((a) => {
                      const checked = editForm.vendedor_artist_ids.includes(a.id);
                      return (
                        <label key={a.id} className="flex items-center gap-2 py-1 cursor-pointer text-sm">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...editForm.vendedor_artist_ids, a.id]
                                : editForm.vendedor_artist_ids.filter((x) => x !== a.id);
                              setEditForm({ ...editForm, vendedor_artist_ids: next });
                            }}
                          />
                          {a.nome}
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">O vendedor só verá a agenda e poderá vender shows dos artistas marcados.</p>
                </div>
              )}
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
                <Button onClick={saveEdit} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Salvar
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
