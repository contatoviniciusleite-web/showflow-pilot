import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type Props = {
  artistId: string;
  artistName: string;
};

type Partner = {
  id: string;
  nome: string;
  funcao: string | null;
  percentual: number;
  ativo: boolean;
  ordem: number;
  _new?: boolean;
  _dirty?: boolean;
};

type CrewMember = {
  id: string;
  nome: string;
  funcao: string | null;
  cache_por_show: number;
  ativo: boolean;
  ordem: number;
  _new?: boolean;
  _dirty?: boolean;
};

export function FinancialConfigTab({ artistId, artistName }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [artistaPct, setArtistaPct] = useState<number>(0);
  const [impostoPct, setImpostoPct] = useState<number>(0);
  const [configId, setConfigId] = useState<string | null>(null);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [removedPartners, setRemovedPartners] = useState<string[]>([]);
  const [removedCrew, setRemovedCrew] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const [c, p, cr] = await Promise.all([
        supabase.from("artist_financial_config").select("*").eq("artist_id", artistId).maybeSingle(),
        supabase.from("artist_partners").select("*").eq("artist_id", artistId).order("ordem"),
        supabase.from("artist_crew").select("*").eq("artist_id", artistId).order("ordem"),
      ]);
      if (!alive) return;
      if (c.data) {
        setConfigId(c.data.id);
        setArtistaPct(Number(c.data.artista_percentual ?? 0));
        setImpostoPct(Number(c.data.imposto_percentual ?? 0));
      } else {
        setConfigId(null);
        setArtistaPct(0);
        setImpostoPct(0);
      }
      setPartners((p.data ?? []) as Partner[]);
      setCrew((cr.data ?? []) as CrewMember[]);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [artistId]);

  const somaPercent = useMemo(() => {
    const ativos = partners.filter((p) => p.ativo);
    return Number(artistaPct || 0) + ativos.reduce((a, p) => a + Number(p.percentual || 0), 0);
  }, [artistaPct, partners]);

  const updatePartner = (id: string, patch: Partial<Partner>) =>
    setPartners((arr) => arr.map((p) => (p.id === id ? { ...p, ...patch, _dirty: true } : p)));
  const updateCrew = (id: string, patch: Partial<CrewMember>) =>
    setCrew((arr) => arr.map((c) => (c.id === id ? { ...c, ...patch, _dirty: true } : c)));

  const addPartner = () =>
    setPartners((arr) => [
      ...arr,
      {
        id: crypto.randomUUID(),
        nome: "",
        funcao: "Sócio",
        percentual: 0,
        ativo: true,
        ordem: arr.length,
        _new: true,
      },
    ]);
  const addCrew = () =>
    setCrew((arr) => [
      ...arr,
      {
        id: crypto.randomUUID(),
        nome: "",
        funcao: "",
        cache_por_show: 0,
        ativo: true,
        ordem: arr.length,
        _new: true,
      },
    ]);
  const removePartner = (id: string) => {
    setPartners((arr) => arr.filter((p) => p.id !== id));
    setRemovedPartners((arr) => [...arr, id]);
  };
  const removeCrewMember = (id: string) => {
    setCrew((arr) => arr.filter((c) => c.id !== id));
    setRemovedCrew((arr) => [...arr, id]);
  };

  const save = async () => {
    if (somaPercent > 100.0001) {
      toast.error("A soma dos percentuais (artista + sócios) ultrapassa 100%.");
      return;
    }
    setSaving(true);
    try {
      // Upsert config
      if (configId) {
        const { error } = await supabase
          .from("artist_financial_config")
          .update({ artista_percentual: artistaPct, imposto_percentual: impostoPct })
          .eq("id", configId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("artist_financial_config")
          .insert({ artist_id: artistId, artista_percentual: artistaPct, imposto_percentual: impostoPct })
          .select("id")
          .single();
        if (error) throw error;
        setConfigId(data.id);
      }

      // Sócios — remoções
      const realRemovedPartners = removedPartners.filter((id) => !partners.find((p) => p.id === id) && !id.includes("local-"));
      if (realRemovedPartners.length > 0) {
        await supabase.from("artist_partners").delete().in("id", realRemovedPartners);
      }
      // Sócios — inserts/updates
      for (const [idx, p] of partners.entries()) {
        const payload = {
          artist_id: artistId,
          nome: p.nome,
          funcao: p.funcao,
          percentual: p.percentual,
          ativo: p.ativo,
          ordem: idx,
        };
        if (p._new) {
          const { error } = await supabase.from("artist_partners").insert(payload);
          if (error) throw error;
        } else if (p._dirty) {
          const { error } = await supabase.from("artist_partners").update(payload).eq("id", p.id);
          if (error) throw error;
        }
      }

      // Equipe — remoções
      const realRemovedCrew = removedCrew.filter((id) => !crew.find((c) => c.id === id));
      if (realRemovedCrew.length > 0) {
        await supabase.from("artist_crew").delete().in("id", realRemovedCrew);
      }
      for (const [idx, c] of crew.entries()) {
        const payload = {
          artist_id: artistId,
          nome: c.nome,
          funcao: c.funcao,
          cache_por_show: c.cache_por_show,
          ativo: c.ativo,
          ordem: idx,
        };
        if (c._new) {
          const { error } = await supabase.from("artist_crew").insert(payload);
          if (error) throw error;
        } else if (c._dirty) {
          const { error } = await supabase.from("artist_crew").update(payload).eq("id", c.id);
          if (error) throw error;
        }
      }

      setRemovedPartners([]);
      setRemovedCrew([]);
      toast.success("Configuração financeira salva");
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Geral */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Geral</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="art-pct">% do artista</Label>
            <Input
              id="art-pct"
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={artistaPct}
              onChange={(e) => setArtistaPct(Number(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="imp-pct">% do imposto</Label>
            <Input
              id="imp-pct"
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={impostoPct}
              onChange={(e) => setImpostoPct(Number(e.target.value) || 0)}
            />
          </div>
        </div>
      </section>

      {/* Sócios */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Sócios e parceiros de {artistName}
          </h3>
          <Button type="button" size="sm" variant="outline" onClick={addPartner}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Adicionar sócio
          </Button>
        </div>

        {somaPercent > 100.0001 && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" />
            Soma dos percentuais (artista + sócios) é {somaPercent.toFixed(2)}% — ultrapassa 100%.
          </div>
        )}
        {somaPercent < 100 && (
          <p className="text-xs text-muted-foreground">
            Soma atual: {somaPercent.toFixed(2)}%. Diferença para 100% ({(100 - somaPercent).toFixed(2)}%) ficará para a Produtora.
          </p>
        )}

        {partners.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum sócio cadastrado.</p>
        ) : (
          <div className="space-y-2">
            {partners.map((p) => (
              <div key={p.id} className="grid grid-cols-12 gap-2 items-center rounded-md border p-2">
                <Input
                  className="col-span-4"
                  placeholder="Nome"
                  value={p.nome}
                  onChange={(e) => updatePartner(p.id, { nome: e.target.value })}
                />
                <Input
                  className="col-span-3"
                  placeholder="Função"
                  value={p.funcao ?? ""}
                  onChange={(e) => updatePartner(p.id, { funcao: e.target.value })}
                />
                <Input
                  className="col-span-2"
                  type="number"
                  step={0.5}
                  min={0}
                  placeholder="%"
                  value={p.percentual}
                  onChange={(e) => updatePartner(p.id, { percentual: Number(e.target.value) || 0 })}
                />
                <div className="col-span-2 flex items-center gap-2">
                  <Switch checked={p.ativo} onCheckedChange={(v) => updatePartner(p.id, { ativo: v })} />
                  <span className="text-xs text-muted-foreground">{p.ativo ? "Ativo" : "Inativo"}</span>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="col-span-1 text-destructive hover:text-destructive"
                  onClick={() => removePartner(p.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Equipe */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Equipe base</h3>
          <Button type="button" size="sm" variant="outline" onClick={addCrew}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Adicionar membro
          </Button>
        </div>

        {crew.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum membro cadastrado.</p>
        ) : (
          <div className="space-y-2">
            {crew.map((c) => (
              <div key={c.id} className="grid grid-cols-12 gap-2 items-center rounded-md border p-2">
                <Input
                  className="col-span-4"
                  placeholder="Nome"
                  value={c.nome}
                  onChange={(e) => updateCrew(c.id, { nome: e.target.value })}
                />
                <Input
                  className="col-span-3"
                  placeholder="Função"
                  value={c.funcao ?? ""}
                  onChange={(e) => updateCrew(c.id, { funcao: e.target.value })}
                />
                <Input
                  className="col-span-2"
                  type="number"
                  step={50}
                  min={0}
                  placeholder="Cachê"
                  value={c.cache_por_show}
                  onChange={(e) => updateCrew(c.id, { cache_por_show: Number(e.target.value) || 0 })}
                />
                <div className="col-span-2 flex items-center gap-2">
                  <Switch checked={c.ativo} onCheckedChange={(v) => updateCrew(c.id, { ativo: v })} />
                  <span className="text-xs text-muted-foreground">{c.ativo ? "Ativo" : "Inativo"}</span>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="col-span-1 text-destructive hover:text-destructive"
                  onClick={() => removeCrewMember(c.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="flex justify-end pt-2 border-t">
        <Button onClick={save} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Salvar configuração
        </Button>
      </div>
    </div>
  );
}
