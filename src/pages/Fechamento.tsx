import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, FileSpreadsheet, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { fmtBRL, fmtDateBR } from "@/lib/exporters";
import { useAuth } from "@/contexts/AuthContext";
import { NewClosingDialog } from "@/components/fechamento/NewClosingDialog";
import { DeleteClosingDialog } from "@/components/fechamento/DeleteClosingDialog";

type Row = {
  id: string;
  artist_id: string;
  semana_inicio: string;
  semana_fim: string;
  status: "rascunho" | "finalizado";
  total_bruto: number;
  total_sobra: number;
  created_at: string;
  artists?: { nome: string } | null;
};

export default function Fechamento() {
  const { roles } = useAuth();
  const canEdit = roles.includes("financeiro");
  const navigate = useNavigate();

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [artists, setArtists] = useState<{ id: string; nome: string }[]>([]);
  const [filterArtist, setFilterArtist] = useState<string>("__all");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [openNew, setOpenNew] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("weekly_closings")
      .select("id, artist_id, semana_inicio, semana_fim, status, total_bruto, total_sobra, created_at, artists(nome)")
      .order("semana_inicio", { ascending: false });
    if (filterArtist !== "__all") q = q.eq("artist_id", filterArtist);
    if (from) q = q.gte("semana_inicio", from);
    if (to) q = q.lte("semana_inicio", to);
    const { data, error } = await q;
    if (!error) setRows((data ?? []) as any);
    setLoading(false);
  };

  useEffect(() => {
    supabase.from("artists").select("id, nome").eq("ativo", true).order("nome").then(({ data }) => {
      setArtists((data ?? []) as any);
    });
  }, []);
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterArtist, from, to]);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold">Fechamentos semanais</h1>
          <p className="text-muted-foreground mt-1">
            Substitui a planilha manual de fechamento da produtora.
          </p>
        </div>
        {canEdit && (
          <Button
            onClick={() => setOpenNew(true)}
            className="bg-[hsl(var(--stage-green))] hover:bg-[hsl(var(--stage-green-deep))] text-black font-semibold shadow-soft transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo fechamento
          </Button>
        )}
      </div>

      <Card className="p-4 mb-4 grid grid-cols-1 md:grid-cols-4 gap-3 shadow-soft">
        <div className="space-y-1.5">
          <Label>Artista</Label>
          <Select value={filterArtist} onValueChange={setFilterArtist}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todos</SelectItem>
              {artists.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>De</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Até</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="flex items-end">
          <Button variant="outline" className="w-full" onClick={() => { setFilterArtist("__all"); setFrom(""); setTo(""); }}>
            Limpar
          </Button>
        </div>
      </Card>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : rows.length === 0 ? (
        <Card className="p-12 text-center shadow-soft">
          <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground mb-4">Nenhum fechamento encontrado.</p>
          {canEdit && (
            <Button onClick={() => setOpenNew(true)}><Plus className="h-4 w-4 mr-2" />Criar primeiro fechamento</Button>
          )}
        </Card>
      ) : (
        <Card className="shadow-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium">Artista</th>
                  <th className="px-3 py-2 font-medium">Período</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium text-right">Total bruto</th>
                  <th className="px-3 py-2 font-medium text-right">Sobra</th>
                  <th className="px-3 py-2 font-medium">Criado em</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2">{r.artists?.nome ?? "—"}</td>
                    <td className="px-3 py-2">Fechamento de {fmtDateBR(r.semana_inicio)} a {fmtDateBR(r.semana_fim)}</td>
                    <td className="px-3 py-2">
                      <Badge variant={r.status === "finalizado" ? "default" : "secondary"}>
                        {r.status === "finalizado" ? "Finalizado" : "Rascunho"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right">{fmtBRL(r.total_bruto)}</td>
                    <td className="px-3 py-2 text-right">{fmtBRL(r.total_sobra)}</td>
                    <td className="px-3 py-2">{new Date(r.created_at).toLocaleDateString("pt-BR")}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button asChild size="sm" variant="ghost">
                          <Link to={`/fechamento/${r.id}`}>Abrir</Link>
                        </Button>
                        {canEdit && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(r)}
                            aria-label="Excluir fechamento"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <NewClosingDialog
        open={openNew}
        onOpenChange={setOpenNew}
        artists={artists}
        onCreated={(id) => { setOpenNew(false); navigate(`/fechamento/${id}`); }}
      />

      <DeleteClosingDialog
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
        closing={deleteTarget ? {
          id: deleteTarget.id,
          semana_inicio: deleteTarget.semana_inicio,
          semana_fim: deleteTarget.semana_fim,
          status: deleteTarget.status,
          artistName: deleteTarget.artists?.nome ?? null,
        } : null}
        onDeleted={() => { setDeleteTarget(null); load(); }}
      />
    </div>
  );
}
