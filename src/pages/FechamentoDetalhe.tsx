import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, CheckCircle2, FileDown, Plus, Trash2, ArrowLeft, Unlock } from "lucide-react";
import { toast } from "sonner";
import { fmtBRL, fmtDateBR } from "@/lib/exporters";
import { computeClosing, type ClosingPartnerInput } from "@/lib/closingCalc";
import { exportClosingPDF } from "@/lib/closingPdf";

type Closing = {
  id: string;
  artist_id: string;
  semana_inicio: string;
  semana_fim: string;
  status: "rascunho" | "finalizado";
  observacoes: string | null;
  finalizado_por: string | null;
  finalizado_em: string | null;
  total_bruto?: number;
};

type ShowRow = {
  id: string;
  show_id: string;
  cache_total: number;
  comissao_vendedor: number;
  incluido: boolean;
  show?: {
    data_show: string;
    horario: string | null;
    local: string | null;
    cidade: string | null;
    vendedor: string | null;
  };
};

type CrewRow = {
  id: string;
  nome: string;
  funcao: string | null;
  cache_por_show: number;
  shows_participados: number;
  total_receber: number;
  ordem: number;
  _new?: boolean;
  _dirty?: boolean;
};

type ExpenseRow = {
  id: string;
  categoria: string;
  descricao: string | null;
  valor: number;
  responsavel: string;
  incluir_no_calculo: boolean;
  _new?: boolean;
  _dirty?: boolean;
};

const CATEGORIAS = ["Van", "Clipe", "Equipamento", "Figurino", "Ensaio", "Outros"];

export default function FechamentoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, roles } = useAuth();
  const canEdit = roles.includes("diretor") || roles.includes("gerente");
  const canExport = canEdit || roles.includes("financeiro");
  const isFullViewer = canEdit || roles.includes("financeiro");
  const isArtistOnly = roles.includes("artista") && !isFullViewer;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState<Closing | null>(null);
  const [artistName, setArtistName] = useState<string>("");
  const [shows, setShows] = useState<ShowRow[]>([]);
  const [crew, setCrew] = useState<CrewRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [removedCrew, setRemovedCrew] = useState<string[]>([]);
  const [removedExpenses, setRemovedExpenses] = useState<string[]>([]);
  const [observacoes, setObservacoes] = useState("");
  const [config, setConfig] = useState<{ artista_percentual: number; imposto_percentual: number }>({
    artista_percentual: 0,
    imposto_percentual: 0,
  });
  const [partners, setPartners] = useState<ClosingPartnerInput[]>([]);
  const [artistDist, setArtistDist] = useState<{ valor_bruto: number; imposto_valor: number; valor_liquido: number; percentual: number } | null>(null);

  const readonly = !canEdit || closing?.status === "finalizado";

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const { data: c, error } = await supabase
      .from("weekly_closings")
      .select("*, artists(nome)")
      .eq("id", id)
      .maybeSingle();
    if (error || !c) {
      toast.error(error?.message || "Fechamento não encontrado");
      setLoading(false);
      return;
    }
    setClosing(c as any);
    setArtistName((c as any).artists?.nome ?? "");
    setObservacoes(c.observacoes ?? "");

    if (isArtistOnly) {
      const { data: dist } = await supabase
        .from("weekly_closing_distribution")
        .select("valor_bruto, imposto_valor, valor_liquido, percentual")
        .eq("closing_id", id)
        .eq("tipo", "artista")
        .maybeSingle();
      if (dist) setArtistDist(dist as any);
      setLoading(false);
      return;
    }

    const [s, cr, ex, cfg, prt] = await Promise.all([
      supabase
        .from("weekly_closing_shows")
        .select("*, show:shows(data_show, horario, local, cidade, vendedor)")
        .eq("closing_id", id),
      supabase.from("weekly_closing_crew").select("*").eq("closing_id", id).order("ordem"),
      supabase.from("weekly_closing_expenses").select("*").eq("closing_id", id).order("created_at"),
      supabase.from("artist_financial_config").select("*").eq("artist_id", c.artist_id).maybeSingle(),
      supabase.from("artist_partners").select("*").eq("artist_id", c.artist_id).order("ordem"),
    ]);
    setShows((s.data ?? []) as any);
    setCrew((cr.data ?? []) as any);
    setExpenses((ex.data ?? []) as any);
    if (cfg.data) {
      setConfig({
        artista_percentual: Number(cfg.data.artista_percentual ?? 0),
        imposto_percentual: Number(cfg.data.imposto_percentual ?? 0),
      });
    }
    setPartners(
      ((prt.data ?? []) as any[])
        .filter((p) => p.ativo)
        .map((p) => ({ nome: p.nome, funcao: p.funcao, percentual: Number(p.percentual), ativo: true, tipo: "socio" })),
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ===== Updates =====
  const updateShow = (rowId: string, patch: Partial<ShowRow>) =>
    setShows((arr) => arr.map((s) => (s.id === rowId ? { ...s, ...patch } : s)));
  const updateCrew = (rowId: string, patch: Partial<CrewRow>) =>
    setCrew((arr) =>
      arr.map((c) => {
        if (c.id !== rowId) return c;
        const next = { ...c, ...patch, _dirty: true };
        next.total_receber = Number(next.cache_por_show || 0) * Number(next.shows_participados || 0);
        return next;
      }),
    );
  const addCrew = () =>
    setCrew((arr) => [
      ...arr,
      {
        id: crypto.randomUUID(),
        nome: "",
        funcao: "",
        cache_por_show: 0,
        shows_participados: 0,
        total_receber: 0,
        ordem: arr.length,
        _new: true,
      },
    ]);
  const removeCrewMember = (rowId: string) => {
    setCrew((arr) => arr.filter((c) => c.id !== rowId));
    setRemovedCrew((arr) => [...arr, rowId]);
  };

  const addExpense = () =>
    setExpenses((arr) => [
      ...arr,
      {
        id: crypto.randomUUID(),
        categoria: "Outros",
        descricao: "",
        valor: 0,
        responsavel: "produtora",
        incluir_no_calculo: true,
        _new: true,
      },
    ]);
  const updateExpense = (rowId: string, patch: Partial<ExpenseRow>) =>
    setExpenses((arr) => arr.map((e) => (e.id === rowId ? { ...e, ...patch, _dirty: true } : e)));
  const removeExpense = (rowId: string) => {
    setExpenses((arr) => arr.filter((e) => e.id !== rowId));
    setRemovedExpenses((arr) => [...arr, rowId]);
  };

  // ===== Cálculo =====
  const totals = useMemo(
    () =>
      computeClosing(
        shows.map((s) => ({
          cache_total: Number(s.cache_total || 0),
          comissao_vendedor: Number(s.comissao_vendedor || 0),
          incluido: s.incluido,
        })),
        crew.map((c) => ({
          cache_por_show: Number(c.cache_por_show || 0),
          shows_participados: Number(c.shows_participados || 0),
        })),
        expenses.map((e) => ({ valor: Number(e.valor || 0), incluir_no_calculo: e.incluir_no_calculo })),
        {
          artista_nome: artistName || "Artista",
          artista_percentual: config.artista_percentual,
          imposto_percentual: config.imposto_percentual,
          partners,
        },
      ),
    [shows, crew, expenses, partners, config, artistName],
  );

  // ===== Save =====
  const persist = async (finalize: boolean) => {
    if (!closing) return;
    setSaving(true);
    try {
      // Shows — só update (não adicionamos novos aqui)
      for (const s of shows) {
        await supabase
          .from("weekly_closing_shows")
          .update({
            cache_total: s.cache_total,
            comissao_vendedor: s.comissao_vendedor,
            incluido: s.incluido,
          })
          .eq("id", s.id);
      }

      // Crew
      if (removedCrew.length > 0) {
        const real = removedCrew.filter((id) => !crew.find((c) => c.id === id));
        if (real.length > 0) {
          await supabase.from("weekly_closing_crew").delete().in("id", real);
        }
      }
      for (const [idx, c] of crew.entries()) {
        const payload = {
          closing_id: closing.id,
          nome: c.nome,
          funcao: c.funcao,
          cache_por_show: c.cache_por_show,
          shows_participados: c.shows_participados,
          total_receber: Number(c.cache_por_show || 0) * Number(c.shows_participados || 0),
          ordem: idx,
        };
        if (c._new) await supabase.from("weekly_closing_crew").insert(payload);
        else if (c._dirty) await supabase.from("weekly_closing_crew").update(payload).eq("id", c.id);
      }

      // Expenses
      if (removedExpenses.length > 0) {
        const real = removedExpenses.filter((id) => !expenses.find((e) => e.id === id));
        if (real.length > 0) {
          await supabase.from("weekly_closing_expenses").delete().in("id", real);
        }
      }
      for (const e of expenses) {
        const payload = {
          closing_id: closing.id,
          categoria: e.categoria,
          descricao: e.descricao,
          valor: e.valor,
          responsavel: e.responsavel,
          incluir_no_calculo: e.incluir_no_calculo,
        };
        if (e._new) await supabase.from("weekly_closing_expenses").insert(payload);
        else if (e._dirty) await supabase.from("weekly_closing_expenses").update(payload).eq("id", e.id);
      }

      // Closing principal
      const updates: any = {
        observacoes,
        total_bruto: totals.totalBruto,
        total_comissao_vendedores: totals.totalComissoes,
        total_equipe: totals.totalEquipe,
        total_despesas: totals.totalDespesas,
        total_sobra: totals.sobra,
      };
      if (finalize) {
        updates.status = "finalizado";
        updates.finalizado_por = user?.id ?? null;
        updates.finalizado_em = new Date().toISOString();
      }
      const { error } = await supabase.from("weekly_closings").update(updates).eq("id", closing.id);
      if (error) throw error;

      // Distribuição (somente em finalize, regrava do zero)
      if (finalize) {
        await supabase.from("weekly_closing_distribution").delete().eq("closing_id", closing.id);
        const dist = totals.distribution.map((d, idx) => ({
          closing_id: closing.id,
          beneficiario: d.beneficiario,
          tipo: d.tipo,
          percentual: d.percentual,
          valor_bruto: d.valor_bruto,
          imposto_valor: d.imposto_valor,
          valor_liquido: d.valor_liquido,
          ordem: idx,
        }));
        if (dist.length > 0) await supabase.from("weekly_closing_distribution").insert(dist);
      }

      toast.success(finalize ? "Fechamento finalizado" : "Rascunho salvo");
      setRemovedCrew([]);
      setRemovedExpenses([]);
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const reopen = async () => {
    if (!closing) return;
    if (!confirm("Reabrir fechamento para edição?")) return;
    setSaving(true);
    const { error } = await supabase
      .from("weekly_closings")
      .update({ status: "rascunho", finalizado_por: null, finalizado_em: null })
      .eq("id", closing.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Fechamento reaberto");
    load();
  };

  const handleExportPDF = () => {
    if (!closing) return;
    exportClosingPDF({
      artistName,
      semanaInicio: closing.semana_inicio,
      semanaFim: closing.semana_fim,
      observacoes,
      shows: shows.map((s) => ({
        data_show: s.show?.data_show ?? "",
        vendedor: s.show?.vendedor,
        local: s.show?.local,
        cidade: s.show?.cidade,
        cache_total: Number(s.cache_total || 0),
        comissao_vendedor: Number(s.comissao_vendedor || 0),
        incluido: s.incluido,
      })),
      crew: crew.map((c) => ({
        nome: c.nome,
        funcao: c.funcao,
        cache_por_show: Number(c.cache_por_show || 0),
        shows_participados: Number(c.shows_participados || 0),
        total_receber: Number(c.cache_por_show || 0) * Number(c.shows_participados || 0),
      })),
      expenses: expenses.map((e) => ({
        categoria: e.categoria,
        descricao: e.descricao,
        valor: Number(e.valor || 0),
        responsavel: e.responsavel,
        incluir_no_calculo: e.incluir_no_calculo,
      })),
      totals,
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!closing) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={() => navigate("/fechamento")}><ArrowLeft className="h-4 w-4 mr-2" />Voltar</Button>
        <p className="mt-4 text-muted-foreground">Fechamento não encontrado.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/fechamento")} className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" />Voltar
          </Button>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-semibold">{artistName}</h1>
            <Badge variant={closing.status === "finalizado" ? "default" : "secondary"}>
              {closing.status === "finalizado" ? "Finalizado" : "Rascunho"}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1">
            Semana de {fmtDateBR(closing.semana_inicio)} a {fmtDateBR(closing.semana_fim)}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canExport && (
            <Button variant="outline" onClick={handleExportPDF}>
              <FileDown className="h-4 w-4 mr-2" />Exportar PDF
            </Button>
          )}
          {canEdit && closing.status === "finalizado" && (
            <Button variant="outline" onClick={reopen} disabled={saving}>
              <Unlock className="h-4 w-4 mr-2" />Reabrir
            </Button>
          )}
          {!readonly && (
            <>
              <Button variant="outline" onClick={() => persist(false)} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Salvar rascunho
              </Button>
              <Button
                onClick={() => {
                  if (confirm("Ao finalizar, o fechamento será bloqueado para edição. Confirmar?")) persist(true);
                }}
                disabled={saving}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />Finalizar
              </Button>
            </>
          )}
        </div>
      </div>

      {isArtistOnly ? (
        <Card className="p-6 shadow-soft space-y-4">
          <h2 className="font-semibold text-lg">Resumo do seu fechamento</h2>
          {!artistDist ? (
            <p className="text-sm text-muted-foreground">
              A distribuição financeira deste fechamento ainda não está disponível.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <Linha label="Total bruto dos shows" value={totals.totalBruto || 0} />
              <Linha label={`Seu percentual (${artistDist.percentual.toFixed(2)}%)`} value={artistDist.valor_bruto} />
              <Linha label="(-) Imposto" value={-artistDist.imposto_valor} />
              <div className="border-t pt-2 sm:col-span-2 font-semibold flex justify-between">
                <span>Valor líquido a receber</span>
                <span>{fmtBRL(artistDist.valor_liquido)}</span>
              </div>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Esta é a visão resumida disponível para o artista. Para detalhes completos, fale com a gerência.
          </p>
        </Card>
      ) : (
      <>
      {/* Seções completas (gerente/diretor/financeiro) */}
      {/* Seção A — Shows */}
      <Card className="p-4 shadow-soft">
        <h2 className="font-semibold mb-3">A. Shows da semana</h2>
        {shows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum show vinculado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left">
                  <th className="px-2 py-1.5">Data</th>
                  <th className="px-2 py-1.5">Vendedor</th>
                  <th className="px-2 py-1.5">Local</th>
                  <th className="px-2 py-1.5 text-right">Cachê</th>
                  <th className="px-2 py-1.5 text-right">Comissão</th>
                  <th className="px-2 py-1.5 text-center">Incluir</th>
                </tr>
              </thead>
              <tbody>
                {shows.map((s) => (
                  <tr key={s.id} className="border-t">
                    <td className="px-2 py-1.5">{fmtDateBR(s.show?.data_show ?? "")}</td>
                    <td className="px-2 py-1.5">{s.show?.vendedor ?? "—"}</td>
                    <td className="px-2 py-1.5">{[s.show?.local, s.show?.cidade].filter(Boolean).join(" — ") || "—"}</td>
                    <td className="px-2 py-1.5">
                      <Input
                        type="number"
                        step={50}
                        className="h-8 text-right"
                        value={s.cache_total}
                        disabled={readonly}
                        onChange={(e) => updateShow(s.id, { cache_total: Number(e.target.value) || 0 })}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        type="number"
                        step={50}
                        className="h-8 text-right"
                        value={s.comissao_vendedor}
                        disabled={readonly}
                        onChange={(e) => updateShow(s.id, { comissao_vendedor: Number(e.target.value) || 0 })}
                      />
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <Switch
                        checked={s.incluido}
                        disabled={readonly}
                        onCheckedChange={(v) => updateShow(s.id, { incluido: v })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/30 font-medium">
                <tr>
                  <td colSpan={3} className="px-2 py-2">
                    {shows.filter((s) => s.incluido).length} shows incluídos
                  </td>
                  <td className="px-2 py-2 text-right">{fmtBRL(totals.totalBruto)}</td>
                  <td className="px-2 py-2 text-right">{fmtBRL(totals.totalComissoes)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      {/* Seção B — Equipe */}
      <Card className="p-4 shadow-soft">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">B. Equipe</h2>
          {!readonly && (
            <Button size="sm" variant="outline" onClick={addCrew}>
              <Plus className="h-3.5 w-3.5 mr-1" />Adicionar membro
            </Button>
          )}
        </div>
        {crew.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum membro cadastrado.</p>
        ) : (
          <div className="space-y-2">
            {crew.map((c) => (
              <div key={c.id} className="grid grid-cols-12 gap-2 items-center rounded-md border p-2">
                <Input
                  className="col-span-3"
                  placeholder="Nome"
                  value={c.nome}
                  disabled={readonly}
                  onChange={(e) => updateCrew(c.id, { nome: e.target.value })}
                />
                <Input
                  className="col-span-2"
                  placeholder="Função"
                  value={c.funcao ?? ""}
                  disabled={readonly}
                  onChange={(e) => updateCrew(c.id, { funcao: e.target.value })}
                />
                <Input
                  className="col-span-2 text-right"
                  type="number"
                  placeholder="Cachê"
                  value={c.cache_por_show}
                  disabled={readonly}
                  onChange={(e) => updateCrew(c.id, { cache_por_show: Number(e.target.value) || 0 })}
                />
                <Input
                  className="col-span-2 text-center"
                  type="number"
                  min={0}
                  placeholder="Shows"
                  value={c.shows_participados}
                  disabled={readonly}
                  onChange={(e) => updateCrew(c.id, { shows_participados: Number(e.target.value) || 0 })}
                />
                <div className="col-span-2 text-right text-sm">{fmtBRL(c.cache_por_show * c.shows_participados)}</div>
                {!readonly && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="col-span-1 text-destructive hover:text-destructive"
                    onClick={() => removeCrewMember(c.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <div className="flex justify-end pt-2 text-sm font-medium">Total equipe: {fmtBRL(totals.totalEquipe)}</div>
          </div>
        )}
      </Card>

      {/* Seção C — Despesas */}
      <Card className="p-4 shadow-soft">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">C. Despesas</h2>
          {!readonly && (
            <Button size="sm" variant="outline" onClick={addExpense}>
              <Plus className="h-3.5 w-3.5 mr-1" />Adicionar despesa
            </Button>
          )}
        </div>
        {expenses.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma despesa registrada.</p>
        ) : (
          <div className="space-y-2">
            {expenses.map((e) => (
              <div key={e.id} className="grid grid-cols-12 gap-2 items-center rounded-md border p-2">
                <div className="col-span-2">
                  <Select
                    value={e.categoria}
                    onValueChange={(v) => updateExpense(e.id, { categoria: v })}
                    disabled={readonly}
                  >
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Input
                  className="col-span-3"
                  placeholder="Descrição"
                  value={e.descricao ?? ""}
                  disabled={readonly}
                  onChange={(ev) => updateExpense(e.id, { descricao: ev.target.value })}
                />
                <Input
                  className="col-span-2 text-right"
                  type="number"
                  step={0.01}
                  placeholder="Valor"
                  value={e.valor}
                  disabled={readonly}
                  onChange={(ev) => updateExpense(e.id, { valor: Number(ev.target.value) || 0 })}
                />
                <div className="col-span-2">
                  <Select
                    value={e.responsavel}
                    onValueChange={(v) => updateExpense(e.id, { responsavel: v })}
                    disabled={readonly}
                  >
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="produtora">Produtora</SelectItem>
                      <SelectItem value="contratante">Contratante</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <Switch
                    checked={e.incluir_no_calculo}
                    disabled={readonly}
                    onCheckedChange={(v) => updateExpense(e.id, { incluir_no_calculo: v })}
                  />
                  <span className="text-xs text-muted-foreground">No cálculo</span>
                </div>
                {!readonly && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="col-span-1 text-destructive hover:text-destructive"
                    onClick={() => removeExpense(e.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <div className="flex justify-end pt-2 text-sm font-medium">
              Total despesas no cálculo: {fmtBRL(totals.totalDespesas)}
            </div>
          </div>
        )}
      </Card>

      {/* Seção D — Cálculo */}
      <Card className="p-4 shadow-soft bg-muted/20">
        <h2 className="font-semibold mb-3">D. Cálculo automático</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1.5 text-sm">
            <Linha label="Total bruto dos shows" value={totals.totalBruto} />
            <Linha label="(-) Comissão vendedores" value={-totals.totalComissoes} />
            <Linha label="(-) Equipe" value={-totals.totalEquipe} />
            <Linha label="(-) Despesas (produtora)" value={-totals.totalDespesas} />
            <div className="border-t pt-2 mt-2 font-semibold flex justify-between">
              <span>(=) SOBRA PARA DISTRIBUIR</span>
              <span>{fmtBRL(totals.sobra)}</span>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <h3 className="font-medium uppercase text-xs tracking-wider text-muted-foreground">Distribuição da sobra</h3>
            {totals.distribution.length === 0 ? (
              <p className="text-muted-foreground">Configure a distribuição financeira do artista.</p>
            ) : (
              totals.distribution.map((d, i) => (
                <div key={i} className="rounded border bg-background p-2">
                  <div className="flex justify-between font-medium">
                    <span>{d.beneficiario} ({d.percentual.toFixed(2)}%)</span>
                    <span>{fmtBRL(d.valor_liquido)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground flex justify-between">
                    <span>Bruto: {fmtBRL(d.valor_bruto)}</span>
                    <span>Imposto: {fmtBRL(d.imposto_valor)}</span>
                  </div>
                </div>
              ))
            )}
            <div className="border-t pt-2 text-xs text-muted-foreground space-y-0.5">
              <div className="flex justify-between"><span>Total impostos</span><span>{fmtBRL(totals.totalImpostos)}</span></div>
              <div className="flex justify-between font-semibold text-foreground"><span>Total líquido</span><span>{fmtBRL(totals.totalLiquido)}</span></div>
            </div>
          </div>
        </div>
      </Card>

      {/* Seção E — Observações */}
      <Card className="p-4 shadow-soft">
        <h2 className="font-semibold mb-3">E. Observações</h2>
        <Textarea
          rows={4}
          value={observacoes}
          disabled={readonly}
          onChange={(e) => setObservacoes(e.target.value)}
          placeholder="Anotações deste fechamento..."
        />
      </Card>
      </>
      )}
    </div>
  );
}

function Linha({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span>{fmtBRL(value)}</span>
    </div>
  );
}
