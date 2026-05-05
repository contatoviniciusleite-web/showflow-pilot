import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { fmtBRL, fmtDateBR } from "@/lib/exporters";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  artists: { id: string; nome: string }[];
  onCreated: (id: string) => void;
};

// Segunda como início (ISO week)
function startOfISOWeek(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay(); // 0=dom..6=sab
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}
function endOfISOWeek(startStr: string): string {
  const d = new Date(startStr + "T00:00:00");
  d.setDate(d.getDate() + 6);
  return d.toISOString().slice(0, 10);
}

export function NewClosingDialog({ open, onOpenChange, artists, onCreated }: Props) {
  const { user } = useAuth();
  const [artistId, setArtistId] = useState<string>("");
  const [refDate, setRefDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [shows, setShows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const semanaInicio = useMemo(() => startOfISOWeek(refDate), [refDate]);
  const semanaFim = useMemo(() => endOfISOWeek(semanaInicio), [semanaInicio]);

  useEffect(() => {
    if (!open) {
      setArtistId("");
      setShows([]);
    }
  }, [open]);

  useEffect(() => {
    if (!artistId) { setShows([]); return; }
    setLoading(true);
    supabase
      .from("shows")
      .select("id, data_show, horario, local, cidade, cache_total, status, vendedor")
      .eq("artist_id", artistId)
      .gte("data_show", semanaInicio)
      .lte("data_show", semanaFim)
      .in("status", ["confirmada"])
      .order("data_show")
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        setShows(data ?? []);
        setLoading(false);
      });
  }, [artistId, semanaInicio, semanaFim]);

  const create = async () => {
    if (!artistId) { toast.error("Selecione o artista"); return; }
    setCreating(true);
    try {
      // Verifica duplicidade
      const { data: existing } = await supabase
        .from("weekly_closings")
        .select("id")
        .eq("artist_id", artistId)
        .eq("semana_inicio", semanaInicio)
        .maybeSingle();
      if (existing) {
        onCreated(existing.id);
        return;
      }

      const { data: closing, error } = await supabase
        .from("weekly_closings")
        .insert({
          artist_id: artistId,
          semana_inicio: semanaInicio,
          semana_fim: semanaFim,
          status: "rascunho",
          criado_por: user?.id ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;

      // Popula shows
      if (shows.length > 0) {
        const rows = shows.map((s) => ({
          closing_id: closing.id,
          show_id: s.id,
          cache_total: Number(s.cache_total ?? 0),
          comissao_vendedor: 0,
          incluido: true,
        }));
        await supabase.from("weekly_closing_shows").insert(rows);
      }

      // Popula equipe base
      const { data: crew } = await supabase
        .from("artist_crew")
        .select("nome, funcao, cache_por_show, ordem")
        .eq("artist_id", artistId)
        .eq("ativo", true)
        .order("ordem");
      if (crew && crew.length > 0) {
        const rows = crew.map((c, idx) => ({
          closing_id: closing.id,
          nome: c.nome,
          funcao: c.funcao,
          cache_por_show: Number(c.cache_por_show ?? 0),
          shows_participados: shows.length,
          total_receber: Number(c.cache_por_show ?? 0) * shows.length,
          ordem: idx,
        }));
        await supabase.from("weekly_closing_crew").insert(rows);
      }

      onCreated(closing.id);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao criar fechamento");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo fechamento semanal</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Artista</Label>
            <Select value={artistId} onValueChange={setArtistId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {artists.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Semana de referência (qualquer dia)</Label>
            <Input type="date" value={refDate} onChange={(e) => setRefDate(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              Semana selecionada: {fmtDateBR(semanaInicio)} a {fmtDateBR(semanaFim)} (segunda a domingo).
            </p>
          </div>

          <div className="rounded-md border p-3 max-h-64 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
            ) : !artistId ? (
              <p className="text-sm text-muted-foreground text-center py-4">Selecione um artista para ver os shows.</p>
            ) : shows.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum show confirmado nessa semana.</p>
            ) : (
              <ul className="text-sm space-y-1">
                {shows.map((s) => (
                  <li key={s.id} className="flex justify-between gap-3 py-1 border-b last:border-0">
                    <span>{fmtDateBR(s.data_show)} — {s.local || s.cidade || "—"}</span>
                    <span className="text-muted-foreground">{fmtBRL(s.cache_total)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={create} disabled={creating || !artistId}>
            {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Criar fechamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
