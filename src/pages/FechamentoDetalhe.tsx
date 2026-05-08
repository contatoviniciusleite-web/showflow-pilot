import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, Save, CheckCircle2, FileDown, Plus, Trash2, ArrowLeft, Unlock, Info, ChevronDown, ChevronRight } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { fmtBRL, fmtDateBR } from "@/lib/exporters";
import { computeClosing, type ClosingPartnerInput } from "@/lib/closingCalc";
import { exportClosingDocumentPDF } from "@/lib/closingDocumentPdf";
import { cn } from "@/lib/utils";
import { DeleteClosingDialog } from "@/components/fechamento/DeleteClosingDialog";

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
  custo_equipe: number;
  incluido: boolean;
  show?: {
    data_show: string;
    horario: string | null;
    local: string | null;
    cidade: string | null;
    vendedor: string | null;
  };
};

type ShowExpense = {
  id: string;
  closing_show_id: string;
  categoria: string;
  descricao: string | null;
  valor: number;
  _new?: boolean;
  _dirty?: boolean;
};

type CrewRow = {
  id: string;
  nome: string;
  funcao: string | null;
  cache_por_show: number;
  shows_participados: number;
  shows_ids: string[];
  total_receber: number;
  ordem: number;
  _new?: boolean;
  _dirty?: boolean;
};

type InvestmentRow = {
  id: string;
  investment_id: string | null;
  descricao: string;
  categoria: string;
  valor_total: number;
  total_parcelas: number;
  numero_parcela: number;
  valor_descontado: number;
  data_compra: string | null;
  observacoes: string | null;
  _new?: boolean;
  _dirty?: boolean;
};

type PendingInvestment = {
  id: string;
  descricao: string;
  categoria: string;
  valor_total: number;
  total_parcelas: number;
  parcelas_pagas: number;
  valor_por_parcela: number;
  data_compra: string | null;
};

type GeneralExpense = {
  id: string;
  categoria: string;
  descricao: string | null;
  closing_show_id: string | null;
  responsavel: "produtora" | "contratante";
  incluir_no_calculo: boolean;
  valor: number;
  _new?: boolean;
  _dirty?: boolean;
};

type DescontoDe = "todos" | "socios" | "artista";

const CATEGORIAS_DESPESA_SEMANAL = [
  "Clipe",
  "Assessoria de imprensa",
  "Marketing / Publicidade",
  "Viagem / Transporte pessoal",
  "Hospedagem pessoal",
  "Equipamento pessoal",
  "Outros",
];

const DESCONTO_DE_LABEL: Record<DescontoDe, string> = {
  todos: "Todos proporcionalmente",
  socios: "Somente sócios",
  artista: "Somente artista",
};

type ClipeRow = {
  id: string;
  profissional: string;
  funcao: string;
  clipe: string;
  quantidade: number;
  valor_por_clipe: number;
  ordem: number;
  desconto_de: DescontoDe;
  categoria: string;
  _new?: boolean;
  _dirty?: boolean;
};

const CATEGORIAS_DESPESA = ["Van", "Equipamento", "Efeitos", "Figurino", "Ensaio", "Combustível", "Alimentação", "Outros"];
const CATEGORIAS_INVEST = ["Equipamento", "Figurino", "Clipe", "Marketing", "Outros"];

export default function FechamentoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, roles } = useAuth();
  const canEdit = roles.includes("financeiro");
  const canExport = roles.includes("diretor") || roles.includes("financeiro") || roles.includes("artista");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const [closing, setClosing] = useState<Closing | null>(null);
  const [artistName, setArtistName] = useState<string>("");
  const [openDelete, setOpenDelete] = useState(false);
  const [shows, setShows] = useState<ShowRow[]>([]);
  const [showExpenses, setShowExpenses] = useState<ShowExpense[]>([]);
  const [removedShowExpenses, setRemovedShowExpenses] = useState<string[]>([]);
  const [expandedShows, setExpandedShows] = useState<Set<string>>(new Set());
  const [crew, setCrew] = useState<CrewRow[]>([]);
  const [removedCrew, setRemovedCrew] = useState<string[]>([]);
  const [investments, setInvestments] = useState<InvestmentRow[]>([]);
  const [removedInvestments, setRemovedInvestments] = useState<string[]>([]);
  const [pendingInvestments, setPendingInvestments] = useState<PendingInvestment[]>([]);
  const [generalExpenses, setGeneralExpenses] = useState<GeneralExpense[]>([]);
  const [removedGeneralExpenses, setRemovedGeneralExpenses] = useState<string[]>([]);
  const [clipes, setClipes] = useState<ClipeRow[]>([]);
  const [removedClipes, setRemovedClipes] = useState<string[]>([]);
  const [observacoes, setObservacoes] = useState("");
  const [config, setConfig] = useState<{ artista_percentual: number; imposto_percentual: number }>({
    artista_percentual: 0,
    imposto_percentual: 0,
  });
  const [partners, setPartners] = useState<ClosingPartnerInput[]>([]);

  const readonly = !canEdit || closing?.status === "finalizado";

  const queryClient = useQueryClient();

  const load = async () => {
    if (!id) return null;
    const { data: c, error } = await supabase
      .from("weekly_closings")
      .select("*, artists(nome)")
      .eq("id", id)
      .maybeSingle();
    if (error || !c) {
      toast.error(error?.message || "Fechamento não encontrado");
      throw new Error(error?.message || "Fechamento não encontrado");
    }
    setClosing(c as any);
    setArtistName((c as any).artists?.nome ?? "");
    setObservacoes(c.observacoes ?? "");

    const [s, se, ge, cr, inv, cfg, prt, cl] = await Promise.all([
      supabase
        .from("weekly_closing_shows")
        .select("*, show:shows(data_show, horario, local, cidade, vendedor)")
        .eq("closing_id", id),
      supabase.from("weekly_closing_show_expenses" as any).select("*").eq("closing_id", id),
      supabase.from("weekly_closing_expenses").select("*").eq("closing_id", id),
      supabase.from("weekly_closing_crew").select("*").eq("closing_id", id).order("ordem"),
      supabase.from("weekly_closing_investments" as any).select("*").eq("closing_id", id).order("created_at"),
      supabase.from("artist_financial_config").select("*").eq("artist_id", c.artist_id).maybeSingle(),
      supabase.from("artist_partners").select("*").eq("artist_id", c.artist_id).order("ordem"),
      supabase.from("weekly_closing_clipe" as any).select("*").eq("closing_id", id).order("ordem"),
    ]);
    setShows((s.data ?? []) as any);
    setShowExpenses(((se.data as any[]) ?? []) as any);
    setClipes(((cl.data as any[]) ?? []).map((x) => ({
      id: x.id, profissional: x.profissional ?? "", funcao: x.funcao ?? "",
      clipe: x.clipe ?? "", quantidade: Number(x.quantidade ?? 0),
      valor_por_clipe: Number(x.valor_por_clipe ?? 0), ordem: x.ordem ?? 0,
      desconto_de: ((x.desconto_de as DescontoDe) ?? "todos"),
      categoria: x.categoria ?? "Clipe",
    })));
    setGeneralExpenses(((ge.data as any[]) ?? []).map((e) => ({
      id: e.id,
      categoria: e.categoria,
      descricao: e.descricao,
      closing_show_id: e.closing_show_id ?? null,
      responsavel: (e.responsavel ?? "produtora") as "produtora" | "contratante",
      incluir_no_calculo: e.incluir_no_calculo ?? true,
      valor: Number(e.valor ?? 0),
    })));
    setCrew(((cr.data ?? []) as any[]).map((c) => {
      const ids: string[] = Array.isArray(c.shows_ids) && c.shows_ids.length > 0
        ? c.shows_ids
        : (((s.data ?? []) as any[]).filter((x) => x.incluido).map((x) => x.id));
      return {
        id: c.id, nome: c.nome, funcao: c.funcao,
        cache_por_show: Number(c.cache_por_show ?? 0),
        shows_ids: ids,
        shows_participados: ids.length,
        total_receber: Number(c.cache_por_show ?? 0) * ids.length,
        ordem: c.ordem ?? 0,
      };
    }));
    setInvestments(((inv.data as any[]) ?? []) as any);
    if (cfg.data) {
      setConfig({
        artista_percentual: Number(cfg.data.artista_percentual ?? 0),
        imposto_percentual: Number(cfg.data.imposto_percentual ?? 0),
      });
    }
    setPartners(
      ((prt.data ?? []) as any[])
        .filter((p) => p.ativo)
        .map((p) => ({ nome: p.nome, funcao: p.funcao, percentual: Number(p.percentual), ativo: true, tipo: "socio" as const })),
    );

    // Carrega investimentos pendentes do artista (parceláveis com saldo)
    const { data: pend } = await supabase
      .from("artist_investments" as any)
      .select("*")
      .eq("artist_id", c.artist_id)
      .eq("ativo", true);
    const pendList = ((pend as any[]) ?? [])
      .filter((p) => p.parcelas_pagas < p.total_parcelas)
      .map((p) => ({
        id: p.id,
        descricao: p.descricao,
        categoria: p.categoria,
        valor_total: Number(p.valor_total),
        total_parcelas: p.total_parcelas,
        parcelas_pagas: p.parcelas_pagas,
        valor_por_parcela: Number(p.valor_por_parcela),
        data_compra: p.data_compra,
      }));
    setPendingInvestments(pendList);

    return { ts: Date.now() };
  };

  // React Query: cacheia o carregamento por 30s para evitar refazer as 8 queries
  // toda vez que abre o fechamento. `load` continua populando os states locais.
  const fechamentoQuery = useQuery({
    queryKey: ["fechamento", id],
    queryFn: load,
    staleTime: 30_000,
    enabled: !!id,
  });

  // Sincroniza loading local com o estado da query
  useEffect(() => {
    setLoading(fechamentoQuery.isLoading || fechamentoQuery.isFetching);
  }, [fechamentoQuery.isLoading, fechamentoQuery.isFetching]);

  // Força refetch (invalida cache) — usado após salvar/reabrir
  const reload = async () => {
    await queryClient.invalidateQueries({ queryKey: ["fechamento", id] });
  };


  useEffect(() => {
    if (closing) {
      document.title = `Fechamento de ${fmtDateBR(closing.semana_inicio)} a ${fmtDateBR(closing.semana_fim)}`;
    }
    return () => { document.title = "ShowFlow"; };
  }, [closing]);

  // ===== Updates =====
  const updateShow = (rowId: string, patch: Partial<ShowRow>) =>
    setShows((arr) => arr.map((s) => (s.id === rowId ? { ...s, ...patch } : s)));

  const toggleShowExpand = (showId: string) =>
    setExpandedShows((set) => {
      const next = new Set(set);
      if (next.has(showId)) next.delete(showId); else next.add(showId);
      return next;
    });

  const addShowExpense = (closingShowId: string) => {
    setShowExpenses((arr) => [
      ...arr,
      {
        id: crypto.randomUUID(),
        closing_show_id: closingShowId,
        categoria: "Outros",
        descricao: "",
        valor: 0,
        _new: true,
      },
    ]);
    setExpandedShows((set) => new Set(set).add(closingShowId));
  };
  const updateShowExpense = (rowId: string, patch: Partial<ShowExpense>) =>
    setShowExpenses((arr) => arr.map((e) => (e.id === rowId ? { ...e, ...patch, _dirty: true } : e)));
  const removeShowExpense = (rowId: string) => {
    setShowExpenses((arr) => arr.filter((e) => e.id !== rowId));
    setRemovedShowExpenses((arr) => [...arr, rowId]);
  };

  // ===== Despesas gerais (Seção C) =====
  const addGeneralExpense = () =>
    setGeneralExpenses((arr) => [
      ...arr,
      {
        id: crypto.randomUUID(),
        categoria: "Outros",
        descricao: "",
        closing_show_id: null,
        responsavel: "produtora",
        incluir_no_calculo: true,
        valor: 0,
        _new: true,
      },
    ]);
  const updateGeneralExpense = (rowId: string, patch: Partial<GeneralExpense>) =>
    setGeneralExpenses((arr) => arr.map((e) => (e.id === rowId ? { ...e, ...patch, _dirty: true } : e)));
  const removeGeneralExpense = (rowId: string) => {
    setGeneralExpenses((arr) => arr.filter((e) => e.id !== rowId));
    setRemovedGeneralExpenses((arr) => [...arr, rowId]);
  };

  const updateCrew = (rowId: string, patch: Partial<CrewRow>) =>
    setCrew((arr) =>
      arr.map((c) => {
        if (c.id !== rowId) return c;
        const next: CrewRow = { ...c, ...patch, _dirty: true };
        next.shows_participados = next.shows_ids.length;
        next.total_receber = Number(next.cache_por_show || 0) * next.shows_participados;
        return next;
      }),
    );
  const toggleCrewShow = (rowId: string, showId: string) =>
    setCrew((arr) =>
      arr.map((c) => {
        if (c.id !== rowId) return c;
        const has = c.shows_ids.includes(showId);
        const ids = has ? c.shows_ids.filter((i) => i !== showId) : [...c.shows_ids, showId];
        return {
          ...c, shows_ids: ids,
          shows_participados: ids.length,
          total_receber: Number(c.cache_por_show || 0) * ids.length,
          _dirty: true,
        };
      }),
    );
  const addCrew = () =>
    setCrew((arr) => {
      const defaultIds = shows.filter((s) => s.incluido).map((s) => s.id);
      return [
        ...arr,
        {
          id: crypto.randomUUID(), nome: "", funcao: "", cache_por_show: 0,
          shows_ids: defaultIds,
          shows_participados: defaultIds.length,
          total_receber: 0, ordem: arr.length, _new: true,
        },
      ];
    });
  const removeCrewMember = (rowId: string) => {
    setCrew((arr) => arr.filter((c) => c.id !== rowId));
    setRemovedCrew((arr) => [...arr, rowId]);
  };

  // ===== Investimentos =====
  const addInvestment = () =>
    setInvestments((arr) => [
      ...arr,
      {
        id: crypto.randomUUID(),
        investment_id: null,
        descricao: "",
        categoria: "Equipamento",
        valor_total: 0,
        total_parcelas: 1,
        numero_parcela: 1,
        valor_descontado: 0,
        data_compra: null,
        observacoes: "",
        _new: true,
      },
    ]);
  const updateInvestment = (rowId: string, patch: Partial<InvestmentRow>) =>
    setInvestments((arr) =>
      arr.map((i) => {
        if (i.id !== rowId) return i;
        const next = { ...i, ...patch, _dirty: true };
        // Recalcula valor por parcela se valor_total ou total_parcelas mudou
        if (("valor_total" in patch || "total_parcelas" in patch) && next.total_parcelas > 0) {
          const auto = Math.round((next.valor_total / next.total_parcelas) * 100) / 100;
          next.valor_descontado = auto;
        }
        return next;
      }),
    );
  const removeInvestment = (rowId: string) => {
    setInvestments((arr) => arr.filter((i) => i.id !== rowId));
    setRemovedInvestments((arr) => [...arr, rowId]);
  };

  const addPendingInvestment = (p: PendingInvestment) => {
    const nextParcela = p.parcelas_pagas + 1;
    setInvestments((arr) => [
      ...arr,
      {
        id: crypto.randomUUID(),
        investment_id: p.id,
        descricao: `${p.descricao} (parcela ${nextParcela}/${p.total_parcelas})`,
        categoria: p.categoria,
        valor_total: p.valor_total,
        total_parcelas: p.total_parcelas,
        numero_parcela: nextParcela,
        valor_descontado: p.valor_por_parcela,
        data_compra: p.data_compra,
        observacoes: null,
        _new: true,
      },
    ]);
    setPendingInvestments((arr) => arr.filter((x) => x.id !== p.id));
    toast.success(`Parcela de "${p.descricao}" incluída.`);
  };

  // ===== Clipe =====
  const addClipe = () =>
    setClipes((arr) => [
      ...arr,
      {
        id: crypto.randomUUID(), profissional: "", funcao: "", clipe: "",
        quantidade: 1, valor_por_clipe: 0, ordem: arr.length,
        desconto_de: "todos" as DescontoDe, categoria: "Clipe", _new: true,
      },
    ]);
  const updateClipe = (rowId: string, patch: Partial<ClipeRow>) =>
    setClipes((arr) => arr.map((c) => (c.id === rowId ? { ...c, ...patch, _dirty: true } : c)));
  const removeClipe = (rowId: string) => {
    setClipes((arr) => arr.filter((c) => c.id !== rowId));
    setRemovedClipes((arr) => [...arr, rowId]);
  };

  const showExpensesByShow = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of showExpenses) {
      if ((e.categoria ?? "").toLowerCase() === "van") continue;
      map.set(e.closing_show_id, (map.get(e.closing_show_id) ?? 0) + Number(e.valor || 0));
    }
    for (const e of generalExpenses) {
      if (!e.closing_show_id) continue;
      if (!e.incluir_no_calculo || e.responsavel !== "produtora") continue;
      if ((e.categoria ?? "").toLowerCase() === "van") continue;
      map.set(e.closing_show_id, (map.get(e.closing_show_id) ?? 0) + Number(e.valor || 0));
    }
    return map;
  }, [showExpenses, generalExpenses]);

  // Van por show — agregada APENAS das despesas Van vinculadas (Seção C ou despesas internas)
  const vanByShow = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of showExpenses) {
      if ((e.categoria ?? "").toLowerCase() !== "van") continue;
      map.set(e.closing_show_id, (map.get(e.closing_show_id) ?? 0) + Number(e.valor || 0));
    }
    for (const e of generalExpenses) {
      if (!e.closing_show_id) continue;
      if (!e.incluir_no_calculo || e.responsavel !== "produtora") continue;
      if ((e.categoria ?? "").toLowerCase() !== "van") continue;
      map.set(e.closing_show_id, (map.get(e.closing_show_id) ?? 0) + Number(e.valor || 0));
    }
    return map;
  }, [showExpenses, generalExpenses]);

  const totalDespesasGeraisCalc = useMemo(
    () => generalExpenses
      .filter((e) => e.incluir_no_calculo && e.responsavel === "produtora" && !e.closing_show_id)
      .reduce((a, e) => a + Number(e.valor || 0), 0),
    [generalExpenses],
  );

  const totalDespesasGeraisCalcAll = useMemo(
    () => generalExpenses
      .filter((e) => e.incluir_no_calculo && e.responsavel === "produtora")
      .reduce((a, e) => a + Number(e.valor || 0), 0),
    [generalExpenses],
  );

  const totalClipe = useMemo(
    () => clipes.reduce((a, c) => a + Number(c.quantidade || 0) * Number(c.valor_por_clipe || 0), 0),
    [clipes],
  );

  // Custo de equipe por show — derivado da Seção B (membros que marcaram aquele show)
  const crewCostByShow = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of crew) {
      const cps = Number(c.cache_por_show || 0);
      for (const sid of c.shows_ids) {
        map.set(sid, (map.get(sid) ?? 0) + cps);
      }
    }
    return map;
  }, [crew]);

  const totals = useMemo(
    () => {
      const showInputs = shows.map((s) => ({
        cache_total: Number(s.cache_total || 0),
        comissao_vendedor: Number(s.comissao_vendedor || 0),
        custo_equipe: 0, // a equipe é somada via parâmetro `crew` para evitar duplicidade
        van: vanByShow.get(s.id) ?? 0,
        despesas_show: showExpensesByShow.get(s.id) ?? 0,
        incluido: s.incluido,
      }));
      if (totalDespesasGeraisCalc > 0) {
        showInputs.push({
          cache_total: 0, comissao_vendedor: 0, custo_equipe: 0, van: 0,
          despesas_show: totalDespesasGeraisCalc, incluido: true,
        });
      }
      return computeClosing(
        showInputs,
        crew.map((c) => ({
          cache_por_show: Number(c.cache_por_show || 0),
          shows_participados: c.shows_ids.length,
        })),
        investments.map((i) => ({ valor_descontado: Number(i.valor_descontado || 0) })),
        {
          artista_nome: artistName || "Artista",
          artista_percentual: config.artista_percentual,
          imposto_percentual: config.imposto_percentual,
          partners,
        },
        clipes.map((c) => ({
          quantidade: Number(c.quantidade || 0),
          valor_por_clipe: Number(c.valor_por_clipe || 0),
          desconto_de: c.desconto_de,
        })),
      );
    },
    [shows, showExpensesByShow, vanByShow, crewCostByShow, crew, investments, partners, config, artistName, totalDespesasGeraisCalc, clipes],
  );

  const totalEquipeBase = useMemo(
    () => crew.reduce((a, c) => a + Number(c.cache_por_show || 0) * c.shows_ids.length, 0),
    [crew],
  );

  // Quando shows são incluídos/excluídos, remove dos shows_ids os ids que não estão mais incluídos
  useEffect(() => {
    const validIds = new Set(shows.filter((s) => s.incluido).map((s) => s.id));
    setCrew((arr) =>
      arr.map((c) => {
        const filtered = c.shows_ids.filter((id) => validIds.has(id));
        if (filtered.length === c.shows_ids.length) return c;
        return {
          ...c, shows_ids: filtered,
          shows_participados: filtered.length,
          total_receber: Number(c.cache_por_show || 0) * filtered.length,
          _dirty: true,
        };
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shows.map((s) => `${s.id}:${s.incluido ? 1 : 0}`).join("|")]);

  // ===== Save =====
  const persist = async (finalize: boolean) => {
    if (!closing) return;
    setSaving(true);
    try {
      // Shows — custo_equipe é derivado da Seção B
      for (const s of shows) {
        await supabase.from("weekly_closing_shows").update({
          cache_total: s.cache_total,
          comissao_vendedor: s.comissao_vendedor,
          custo_equipe: crewCostByShow.get(s.id) ?? 0,
          incluido: s.incluido,
        }).eq("id", s.id);
      }

      // Show expenses
      if (removedShowExpenses.length > 0) {
        const real = removedShowExpenses.filter((id) => !showExpenses.find((e) => e.id === id));
        if (real.length > 0) {
          await supabase.from("weekly_closing_show_expenses" as any).delete().in("id", real);
        }
      }
      for (const e of showExpenses) {
        const payload = {
          closing_id: closing.id,
          closing_show_id: e.closing_show_id,
          categoria: e.categoria,
          descricao: e.descricao,
          valor: e.valor,
        };
        if (e._new) await supabase.from("weekly_closing_show_expenses" as any).insert(payload);
        else if (e._dirty) await supabase.from("weekly_closing_show_expenses" as any).update(payload).eq("id", e.id);
      }

      // Despesas gerais (Seção C)
      if (removedGeneralExpenses.length > 0) {
        const real = removedGeneralExpenses.filter((id) => !generalExpenses.find((e) => e.id === id));
        if (real.length > 0) await supabase.from("weekly_closing_expenses").delete().in("id", real);
      }
      for (const e of generalExpenses) {
        const payload = {
          closing_id: closing.id,
          closing_show_id: e.closing_show_id,
          categoria: e.categoria,
          descricao: e.descricao,
          responsavel: e.responsavel,
          incluir_no_calculo: e.incluir_no_calculo,
          valor: e.valor,
        };
        if (e._new) await supabase.from("weekly_closing_expenses").insert(payload);
        else if (e._dirty) await supabase.from("weekly_closing_expenses").update(payload).eq("id", e.id);
      }

      if (removedCrew.length > 0) {
        const real = removedCrew.filter((id) => !crew.find((c) => c.id === id));
        if (real.length > 0) await supabase.from("weekly_closing_crew").delete().in("id", real);
      }
      for (const [idx, c] of crew.entries()) {
        const payload = {
          closing_id: closing.id, nome: c.nome, funcao: c.funcao,
          cache_por_show: c.cache_por_show, shows_participados: c.shows_ids.length,
          shows_ids: c.shows_ids,
          total_receber: Number(c.cache_por_show || 0) * c.shows_ids.length, ordem: idx,
        };
        if (c._new) await supabase.from("weekly_closing_crew").insert(payload as any);
        else if (c._dirty) await supabase.from("weekly_closing_crew").update(payload as any).eq("id", c.id);
      }

      // Investments — primeiro processa novos cadastros (parcelados sem investment_id)
      for (const inv of investments) {
        if (inv._new && !inv.investment_id && inv.total_parcelas > 1) {
          const valorParcela = Math.round((inv.valor_total / inv.total_parcelas) * 100) / 100;
          const { data: created } = await supabase.from("artist_investments" as any).insert({
            artist_id: closing.artist_id,
            descricao: inv.descricao.replace(/\s*\(parcela.*\)\s*$/i, ""),
            categoria: inv.categoria,
            valor_total: inv.valor_total,
            total_parcelas: inv.total_parcelas,
            parcelas_pagas: 1,
            valor_por_parcela: valorParcela,
            closing_id_origem: closing.id,
            data_compra: inv.data_compra,
            observacoes: inv.observacoes,
          }).select().maybeSingle();
          if (created) inv.investment_id = (created as any).id;
        }
      }

      if (removedInvestments.length > 0) {
        const real = removedInvestments.filter((id) => !investments.find((i) => i.id === id));
        if (real.length > 0) await supabase.from("weekly_closing_investments" as any).delete().in("id", real);
      }
      for (const inv of investments) {
        const payload = {
          closing_id: closing.id,
          investment_id: inv.investment_id,
          descricao: inv.descricao,
          categoria: inv.categoria,
          valor_total: inv.valor_total,
          total_parcelas: inv.total_parcelas,
          numero_parcela: inv.numero_parcela,
          valor_descontado: inv.valor_descontado,
          data_compra: inv.data_compra,
          observacoes: inv.observacoes,
        };
        if (inv._new) await supabase.from("weekly_closing_investments" as any).insert(payload);
        else if (inv._dirty) await supabase.from("weekly_closing_investments" as any).update(payload).eq("id", inv.id);
      }

      // Clipes
      if (removedClipes.length > 0) {
        const real = removedClipes.filter((id) => !clipes.find((c) => c.id === id));
        if (real.length > 0) await supabase.from("weekly_closing_clipe" as any).delete().in("id", real);
      }
      for (const [idx, c] of clipes.entries()) {
        const payload = {
          closing_id: closing.id,
          profissional: c.profissional, funcao: c.funcao, clipe: c.clipe,
          quantidade: c.quantidade, valor_por_clipe: c.valor_por_clipe, ordem: idx,
          desconto_de: c.desconto_de, categoria: c.categoria,
        };
        if (c._new) await supabase.from("weekly_closing_clipe" as any).insert(payload);
        else if (c._dirty) await supabase.from("weekly_closing_clipe" as any).update(payload).eq("id", c.id);
      }

      // Closing principal
      const updates: any = {
        observacoes,
        total_bruto: totals.totalBruto,
        total_comissao_vendedores: totals.totalComissoes,
        total_equipe: totals.totalEquipe,
        total_despesas: totals.totalDespesasShows,
        total_clipe: totals.totalClipe,
        total_sobra: totals.sobra,
      };
      if (finalize) {
        updates.status = "finalizado";
        updates.finalizado_por = user?.id ?? null;
        updates.finalizado_em = new Date().toISOString();
      }
      const { error } = await supabase.from("weekly_closings").update(updates).eq("id", closing.id);
      if (error) throw error;

      // Distribuição (somente em finalize)
      if (finalize) {
        await supabase.from("weekly_closing_distribution").delete().eq("closing_id", closing.id);
        const dist = totals.distribution.map((d, idx) => ({
          closing_id: closing.id,
          beneficiario: d.beneficiario, tipo: d.tipo, percentual: d.percentual,
          valor_bruto: d.valor_bruto, imposto_valor: d.imposto_valor,
          investimento_valor: d.investimento_valor,
          valor_liquido: d.valor_liquido, ordem: idx,
        }));
        if (dist.length > 0) await supabase.from("weekly_closing_distribution").insert(dist as any);

        // Atualiza parcelas pagas dos investimentos vinculados
        for (const inv of investments) {
          if (inv.investment_id) {
            await supabase.from("artist_investments" as any)
              .update({ parcelas_pagas: inv.numero_parcela })
              .eq("id", inv.investment_id);
          }
        }

        // Saldo de comissão da produtora
        try {
          const { recalcProducerCommissionBalance } = await import("@/lib/producerCommission");
          await recalcProducerCommissionBalance(closing.id);
        } catch (e) { console.error("recalcProducerCommissionBalance", e); }

        // Gerar ordens de pagamento automaticamente
        let ordersOk = true;
        let ordersResult: { created: number; keptPaid: number; keptCanceled: number } | null = null;
        try {
          console.log("Iniciando geração de ordens para fechamento:", closing.id);
          const { generatePaymentOrdersForClosing } = await import("@/lib/paymentOrders");
          ordersResult = await generatePaymentOrdersForClosing(closing.id);
          console.log("Ordens geradas:", ordersResult);
        } catch (e) {
          ordersOk = false;
          console.error("Erro detalhado ao gerar ordens de pagamento:", e);
        }

        if (ordersOk) {
          toast.success(
            `Fechamento finalizado! ${ordersResult?.created ?? 0} ordem(ns) de pagamento gerada(s).`,
          );
        } else {
          toast.warning("Fechamento finalizado, mas houve um erro ao gerar as ordens de pagamento. Acesse Pagamentos para verificar.");
        }
      } else {
        toast.success("Rascunho salvo");
      }

      setRemovedCrew([]); setRemovedShowExpenses([]); setRemovedInvestments([]); setRemovedGeneralExpenses([]); setRemovedClipes([]);
      await reload();
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
    const { error } = await supabase.from("weekly_closings")
      .update({ status: "rascunho", finalizado_por: null, finalizado_em: null })
      .eq("id", closing.id);
    setSaving(false);
    if (error) return toast.error(error.message);

    // Cancelar ordens pendentes ao reabrir
    try {
      await supabase
        .from("payment_orders")
        .update({ status: "cancelado", motivo_cancelamento: "Fechamento reaberto para edição" })
        .eq("closing_id", closing.id)
        .in("status", ["pendente", "agendado"]);
    } catch (e) {
      console.error("cancelar ordens", e);
    }

    toast.success("Fechamento reaberto");
    load();
  };

  const handleExportPDF = async () => {
    if (!closing) return;
    setExporting(true);
    try {
      const filename = `fechamento_${(artistName || "artista")}_${closing.semana_inicio}.pdf`
        .replace(/\s+/g, "_").toLowerCase();

      // Map de id do closing_show -> label legível do show
      const showLabel = (closingShowId: string | null) => {
        if (!closingShowId) return "Geral";
        const sh = shows.find((s) => s.id === closingShowId);
        if (!sh?.show) return "—";
        return `${fmtDateBR(sh.show.data_show)} — ${sh.show.local ?? "Show"}`;
      };

      const pdfShows = shows.map((s) => {
        const cache = Number(s.cache_total || 0);
        const com = Number(s.comissao_vendedor || 0);
        const eq = crewCostByShow.get(s.id) ?? 0;
        const van = vanByShow.get(s.id) ?? 0;
        const desp = showExpensesByShow.get(s.id) ?? 0;
        return {
          data_show: s.show?.data_show ?? "",
          vendedor: s.show?.vendedor ?? null,
          local: s.show?.local ?? null,
          cidade: s.show?.cidade ?? null,
          cache_total: cache,
          comissao_vendedor: com,
          custo_equipe: eq,
          van,
          despesas_show: desp,
          sobra: s.incluido ? cache - com - eq - van - desp : 0,
          incluido: s.incluido,
        };
      });

      const pdfCrew = crew.map((c) => {
        const labels = c.shows_ids
          .map((id) => {
            const sh = shows.find((x) => x.id === id);
            return sh?.show ? fmtDateBR(sh.show.data_show) : null;
          })
          .filter(Boolean) as string[];
        return {
          nome: c.nome,
          funcao: c.funcao,
          cache_por_show: Number(c.cache_por_show || 0),
          shows_label: labels.join(", ") || "—",
          shows_participados: c.shows_ids.length,
          total_receber: Number(c.cache_por_show || 0) * c.shows_ids.length,
        };
      });

      const pdfExpenses = generalExpenses.map((e) => ({
        categoria: e.categoria,
        descricao: e.descricao,
        show_label: showLabel(e.closing_show_id),
        responsavel: e.responsavel,
        incluir_no_calculo: e.incluir_no_calculo,
        valor: Number(e.valor || 0),
      }));

      const pdfInvestments = investments.map((i) => ({
        descricao: i.descricao,
        categoria: i.categoria,
        valor_total: Number(i.valor_total || 0),
        total_parcelas: Number(i.total_parcelas || 1),
        numero_parcela: Number(i.numero_parcela || 1),
        valor_descontado: Number(i.valor_descontado || 0),
      }));

      const pdfClipes = clipes.map((c) => ({
        profissional: c.profissional,
        funcao: c.funcao,
        clipe: c.clipe,
        quantidade: Number(c.quantidade || 0),
        valor_por_clipe: Number(c.valor_por_clipe || 0),
        total: Number(c.quantidade || 0) * Number(c.valor_por_clipe || 0),
      }));

      await exportClosingDocumentPDF({
        artistName,
        semanaInicio: closing.semana_inicio,
        semanaFim: closing.semana_fim,
        status: closing.status,
        observacoes,
        impostoPercentual: config.imposto_percentual,
        shows: pdfShows,
        crew: pdfCrew,
        expenses: pdfExpenses,
        investments: pdfInvestments,
        clipes: pdfClipes,
        totals,
      }, filename);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao exportar PDF");
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!closing) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={() => navigate("/fechamento")}><ArrowLeft className="h-4 w-4 mr-2" />Voltar</Button>
        <p className="mt-4 text-muted-foreground">Fechamento não encontrado.</p>
      </div>
    );
  }

  const nIncluidos = shows.filter((s) => s.incluido).length;
  const crewTooltipText = crew.length === 0
    ? "Nenhum membro de equipe cadastrado."
    : crew.map((c) => `${c.nome || "—"}: ${fmtBRL(c.cache_por_show)} × ${c.shows_participados} = ${fmtBRL(c.cache_por_show * c.shows_participados)}`).join("\n");

  return (
    <TooltipProvider delayDuration={200}>
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6" ref={exportRef}>
      {/* HEADER ESCURO */}
      <div className="rounded-xl overflow-hidden shadow-elevated animate-fade-in">
        <div className="bg-[#1a1a1a] text-white p-5 md:p-6">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/fechamento")}
              className="text-white/80 hover:text-white hover:bg-white/10 -ml-2">
              <ArrowLeft className="h-4 w-4 mr-2" />Voltar
            </Button>
            <span className={cn(
              "inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold",
              closing.status === "finalizado"
                ? "bg-[#00C853] text-black"
                : "bg-[#f59e0b] text-black"
            )}>
              {closing.status === "finalizado" ? "✓ Finalizado" : "● Rascunho"}
            </span>
          </div>
          <div className="flex items-end justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold text-white">
                Fechamento de {fmtDateBR(closing.semana_inicio)} a {fmtDateBR(closing.semana_fim)}
              </h1>
              <p className="text-white/70 mt-1.5 text-sm md:text-base">
                <span className="font-medium text-white">{artistName}</span>
                <span className="mx-2 text-white/40">·</span>
                {nIncluidos} {nIncluidos === 1 ? "show" : "shows"}
                <span className="mx-2 text-white/40">·</span>
                <span className="text-[#00C853] font-medium">{fmtBRL(totals.totalBruto)}</span>
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {canExport && (
                <Button variant="outline" onClick={handleExportPDF} disabled={exporting}
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white">
                  {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileDown className="h-4 w-4 mr-2" />}
                  Exportar PDF
                </Button>
              )}
              {canEdit && closing.status === "finalizado" && (
                <Button variant="outline" onClick={reopen} disabled={saving}
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white">
                  <Unlock className="h-4 w-4 mr-2" />Reabrir
                </Button>
              )}
              {!readonly && (
                <>
                  <Button variant="outline" onClick={() => persist(false)} disabled={saving}
                    className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white">
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Salvar rascunho
                  </Button>
                  <Button
                    onClick={() => { if (confirm("Ao finalizar, o fechamento será bloqueado para edição. Confirmar?")) persist(true); }}
                    disabled={saving}
                    className="bg-[#00C853] hover:bg-[#00a843] text-black font-semibold"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />Finalizar
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="h-0.5 bg-[#00C853]" />
      </div>

      {/* CARDS DE RESUMO */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-fade-in">
        <SummaryCard icon="💰" iconBg="bg-green-100" label="Cachê Bruto"
          value={fmtBRL(totals.totalBruto)}
          sub={`${nIncluidos} ${nIncluidos === 1 ? "show confirmado" : "shows confirmados"}`} />
        <SummaryCard icon="📉" iconBg="bg-red-100" label="Total Custos"
          value={fmtBRL(totals.totalCustos)} sub="Comissão + Equipe + Van + Despesas + Clipe" />
        <SummaryCard icon="✅" iconBg="bg-green-100" label="Sobra para distribuir"
          value={fmtBRL(totals.sobraDistribuir)} sub="Após todos os descontos e impostos" accent />
        <SummaryCard icon="🏛️" iconBg="bg-gray-100" label="Total Impostos"
          value={fmtBRL(totals.totalImpostos)} sub={`${config.imposto_percentual.toFixed(2)}% sobre o bruto`} />
      </div>

      {/* Seção A — Shows */}
      <Card className="shadow-soft overflow-hidden border-l-[3px] border-l-[#00C853] animate-fade-in">
        <div className="px-4 py-3 bg-green-50/70 dark:bg-green-950/20 border-b flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-semibold flex items-center gap-2">
            <span>🎤</span> A. Shows da semana
          </h2>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#00C853] text-black">
            {shows.length} {shows.length === 1 ? "show" : "shows"}
          </span>
        </div>
        <div className="p-4">
        {shows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum show vinculado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs md:text-sm min-w-[1100px]">
              <thead className="bg-[#1a1a1a] text-white">
                <tr className="text-left text-white">
                  <th className="px-2 py-2 font-medium">Data</th>
                  <th className="px-2 py-2 font-medium">Vendedor</th>
                  <th className="px-2 py-2 font-medium">Local — Cidade</th>
                  <th className="px-2 py-2 font-medium text-right w-[120px]">Cachê</th>
                  <th className="px-2 py-2 font-medium text-right w-[180px]">Comissão (% / R$)</th>
                  <th className="px-2 py-2 font-medium text-right w-[140px]">
                    <span className="inline-flex items-center gap-1">
                      Custo equipe
                      <Tooltip>
                        <TooltipTrigger asChild><Info className="h-3 w-3 text-white/60 cursor-help" /></TooltipTrigger>
                        <TooltipContent className="whitespace-pre-wrap max-w-xs text-left">{crewTooltipText}</TooltipContent>
                      </Tooltip>
                    </span>
                  </th>
                  <th className="px-2 py-2 font-medium text-right">Van</th>
                  <th className="px-2 py-2 font-medium text-right">Despesas</th>
                  <th className="px-2 py-2 font-medium text-right">Sobra</th>
                  <th className="px-2 py-2 font-medium text-center">Incluir</th>
                </tr>
              </thead>
              <tbody>
                {shows.map((s, sIdx) => {
                  const despesasShow = showExpensesByShow.get(s.id) ?? 0;
                  const vanShow = vanByShow.get(s.id) ?? 0;
                  const equipeShow = crewCostByShow.get(s.id) ?? 0;
                  const totalCustosShow = Number(s.comissao_vendedor || 0) + equipeShow + vanShow + despesasShow;
                  const sobraShow = Number(s.cache_total || 0) - totalCustosShow;
                  const pctComissao = s.cache_total > 0 ? (s.comissao_vendedor / s.cache_total) * 100 : 0;
                  const equipeTooltip = crew
                    .filter((c) => c.shows_ids.includes(s.id))
                    .map((c) => `${c.nome || "—"}: ${fmtBRL(c.cache_por_show)}`)
                    .join("\n") || "Nenhum membro de equipe marcou este show.";
                  return (
                    <>
                      <tr key={s.id} className={cn(
                        "border-t transition-colors duration-150 odd:bg-white even:bg-gray-50/60 dark:odd:bg-transparent dark:even:bg-muted/20 hover:bg-green-50/60 dark:hover:bg-green-950/20",
                        !s.incluido && "opacity-50"
                      )}>
                        <td className="px-2 py-1.5 whitespace-nowrap">{fmtDateBR(s.show?.data_show ?? "")}</td>
                        <td className="px-2 py-1.5">{s.show?.vendedor ?? "—"}</td>
                        <td className="px-2 py-1.5">{[s.show?.local, s.show?.cidade].filter(Boolean).join(" — ") || "—"}</td>
                        <td className="px-2 py-1.5">
                          <CurrencyInput className="h-8 text-right" value={s.cache_total} disabled={readonly}
                            onValueChange={(v) => updateShow(s.id, { cache_total: v })} />
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="flex gap-1">
                            <Input type="number" step={0.5} className="h-8 w-16 text-right" placeholder="%"
                              value={pctComissao ? Number(pctComissao.toFixed(2)) : ""}
                              disabled={readonly || !s.cache_total}
                              onChange={(e) => {
                                const pct = Number(e.target.value) || 0;
                                updateShow(s.id, { comissao_vendedor: Math.round(((s.cache_total * pct) / 100) * 100) / 100 });
                              }} />
                            <CurrencyInput className="h-8 text-right" value={s.comissao_vendedor} disabled={readonly}
                              onValueChange={(v) => updateShow(s.id, { comissao_vendedor: v })} />
                          </div>
                        </td>
                        <td className="px-2 py-1.5 text-right whitespace-nowrap">
                          <Tooltip>
                            <TooltipTrigger asChild><span className="cursor-help">{fmtBRL(equipeShow)}</span></TooltipTrigger>
                            <TooltipContent className="whitespace-pre-wrap max-w-xs text-left">{equipeTooltip}</TooltipContent>
                          </Tooltip>
                        </td>
                        <td className="px-2 py-1.5 text-right whitespace-nowrap">{fmtBRL(vanShow)}</td>
                        <td className="px-2 py-1.5 text-right whitespace-nowrap">{fmtBRL(despesasShow)}</td>
                        <td className={cn("px-2 py-1.5 text-right whitespace-nowrap font-medium",
                          sobraShow >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive")}>
                          {sobraShow >= 0 ? "↑ " : "↓ "}{fmtBRL(sobraShow)}
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <Switch checked={s.incluido} disabled={readonly}
                            onCheckedChange={(v) => updateShow(s.id, { incluido: v })} />
                        </td>
                      </tr>
                    </>
                  );
                })}
              </tbody>
              <tfoot className="bg-[#1a1a1a] text-white font-semibold">
                <tr>
                  <td colSpan={3} className="px-2 py-2">{nIncluidos} shows incluídos</td>
                  <td className="px-2 py-2 text-right">{fmtBRL(totals.totalBruto)}</td>
                  <td className="px-2 py-2 text-right">{fmtBRL(totals.totalComissoes)}</td>
                  <td className="px-2 py-2 text-right">{fmtBRL(totals.totalEquipe)}</td>
                  <td className="px-2 py-2 text-right">{fmtBRL(totals.totalVan)}</td>
                  <td className="px-2 py-2 text-right">{fmtBRL(totals.totalDespesasShows)}</td>
                  <td className="px-2 py-2 text-right">{fmtBRL(totals.totalBruto - totals.totalComissoes - totals.totalEquipe - totals.totalVan - totals.totalDespesasShows)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        </div>
      </Card>

      {/* Seção B — Equipe */}
      <Card className="shadow-soft overflow-hidden border-l-[3px] border-l-[#185FA5] animate-fade-in">
        <div className="px-4 py-3 bg-blue-50/70 dark:bg-blue-950/20 border-b flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="font-semibold flex items-center gap-2">
              <span>👥</span> B. Equipe
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Marque os shows em que cada membro participou. O custo de equipe de cada show é calculado automaticamente.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#185FA5] text-white">
              {crew.length} {crew.length === 1 ? "membro" : "membros"}
            </span>
            {!readonly && (
              <Button size="sm" variant="outline" onClick={addCrew}><Plus className="h-3.5 w-3.5 mr-1" />Adicionar membro</Button>
            )}
          </div>
        </div>
        <div className="p-4">
        {crew.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum membro cadastrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead className="bg-[#0C447C] text-white">
                <tr className="text-left text-white">
                  <th className="px-2 py-2 font-medium">Nome</th>
                  <th className="px-2 py-2 font-medium">Função</th>
                  <th className="px-2 py-2 font-medium text-right w-[140px]">Cachê/show</th>
                  <th className="px-2 py-2 font-medium">Shows participados</th>
                  <th className="px-2 py-2 font-medium text-right w-[110px]">Total</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {crew.map((c) => {
                  const incluidos = shows.filter((s) => s.incluido);
                  return (
                    <tr key={c.id} className="border-t align-top">
                      <td className="px-2 py-2">
                        <Input className="h-8" placeholder="Nome" value={c.nome} disabled={readonly}
                          onChange={(e) => updateCrew(c.id, { nome: e.target.value })} />
                      </td>
                      <td className="px-2 py-2">
                        <Input className="h-8" placeholder="Função" value={c.funcao ?? ""} disabled={readonly}
                          onChange={(e) => updateCrew(c.id, { funcao: e.target.value })} />
                      </td>
                      <td className="px-2 py-2">
                        <CurrencyInput className="h-8 text-right" value={c.cache_por_show} disabled={readonly}
                          onValueChange={(v) => updateCrew(c.id, { cache_por_show: v })} />
                      </td>
                      <td className="px-2 py-2">
                        {incluidos.length === 0 ? (
                          <span className="text-xs text-muted-foreground italic">Nenhum show incluído</span>
                        ) : (
                          <div className="space-y-1">
                            {incluidos.map((s, idx) => {
                              const checked = c.shows_ids.includes(s.id);
                              const label = `Show ${idx + 1} — ${s.show?.local || s.show?.cidade || "Show"} ${s.show?.data_show ? fmtDateBR(s.show.data_show).slice(0, 5) : ""}`.trim();
                              return (
                                <label key={s.id} className="flex items-center gap-2 text-xs cursor-pointer">
                                  <Checkbox checked={checked} disabled={readonly}
                                    onCheckedChange={() => toggleCrewShow(c.id, s.id)} />
                                  <span>{label}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-2 text-right text-sm font-medium whitespace-nowrap">
                        {fmtBRL(Number(c.cache_por_show || 0) * c.shows_ids.length)}
                      </td>
                      <td className="px-2 py-2">
                        {!readonly && (
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => removeCrewMember(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-[#0C447C] text-white font-semibold">
                <tr>
                  <td colSpan={4} className="px-2 py-2 text-xs text-white/80">
                    Baseado em {shows.filter((s) => s.incluido).length} show(s) incluído(s) neste fechamento
                  </td>
                  <td className="px-2 py-2 text-right">{fmtBRL(totalEquipeBase)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        </div>
      </Card>

      {/* Seção C — Despesas gerais */}
      <Card className="shadow-soft overflow-hidden border-l-[3px] border-l-[#EA7517] animate-fade-in">
        <div className="px-4 py-3 bg-orange-50/70 dark:bg-orange-950/20 border-b flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="font-semibold flex items-center gap-2">
              <span>🧾</span> C. Despesas
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Despesas gerais do período. Vincule a um show para somar à coluna "Despesas" daquele show.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#EA7517] text-white">
              {generalExpenses.length} {generalExpenses.length === 1 ? "item" : "itens"} · {fmtBRL(totalDespesasGeraisCalcAll)}
            </span>
            {!readonly && (
              <Button size="sm" variant="outline" onClick={addGeneralExpense}>
                <Plus className="h-3.5 w-3.5 mr-1" />Adicionar despesa
              </Button>
            )}
          </div>
        </div>
        <div className="p-4">
        {generalExpenses.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma despesa lançada.</p>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-2 px-2 text-xs text-muted-foreground uppercase tracking-wider">
              <div className="col-span-2">Categoria</div>
              <div className="col-span-3">Descrição</div>
              <div className="col-span-2">Vincular show</div>
              <div className="col-span-2">Responsável</div>
              <div className="col-span-1 text-center">Calcular</div>
              <div className="col-span-1 text-right">Valor</div>
              <div className="col-span-1" />
            </div>
            {generalExpenses.map((e) => (
              <div key={e.id} className="grid grid-cols-12 gap-2 items-center rounded-md border p-2">
                <Select value={e.categoria} onValueChange={(v) => updateGeneralExpense(e.id, { categoria: v })} disabled={readonly}>
                  <SelectTrigger className="col-span-2 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIAS_DESPESA.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
                <Input className="col-span-3 h-8" placeholder="Descrição" value={e.descricao ?? ""} disabled={readonly}
                  onChange={(ev) => updateGeneralExpense(e.id, { descricao: ev.target.value })} />
                <Select
                  value={e.closing_show_id ?? "__none__"}
                  onValueChange={(v) => updateGeneralExpense(e.id, { closing_show_id: v === "__none__" ? null : v })}
                  disabled={readonly}
                >
                  <SelectTrigger className="col-span-2 h-8"><SelectValue placeholder="Não vinculado" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Não vinculado</SelectItem>
                    {shows.map((s, idx) => (
                      <SelectItem key={s.id} value={s.id}>
                        Show {idx + 1} — {[s.show?.local, fmtDateBR(s.show?.data_show ?? "")].filter(Boolean).join(" ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={e.responsavel} onValueChange={(v) => updateGeneralExpense(e.id, { responsavel: v as any, incluir_no_calculo: v === "produtora" })} disabled={readonly}>
                  <SelectTrigger className="col-span-2 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="produtora">Produtora</SelectItem>
                    <SelectItem value="contratante">Contratante</SelectItem>
                  </SelectContent>
                </Select>
                <div className="col-span-1 flex justify-center">
                  <Switch checked={e.incluir_no_calculo} disabled={readonly || e.responsavel === "contratante"}
                    onCheckedChange={(v) => updateGeneralExpense(e.id, { incluir_no_calculo: v })} />
                </div>
                <CurrencyInput className="col-span-1 h-8 text-right" value={e.valor} disabled={readonly}
                  onValueChange={(v) => updateGeneralExpense(e.id, { valor: v })} />
                {!readonly && (
                  <Button size="icon" variant="ghost" className="col-span-1 h-8 w-8 text-destructive"
                    onClick={() => removeGeneralExpense(e.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
            <div className="flex justify-end pt-2 text-sm font-medium">
              TOTAL DESPESAS (no cálculo): {fmtBRL(totalDespesasGeraisCalcAll)}
            </div>
          </div>
        )}
        </div>
      </Card>

      {/* Seção D — Investimentos */}
      <Card className="shadow-soft overflow-hidden border-l-[3px] border-l-[#534AB7] animate-fade-in">
        <div className="px-4 py-3 bg-purple-50/70 dark:bg-purple-950/20 border-b flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="font-semibold flex items-center gap-2">
              <span>📦</span> D. Investimentos
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Descontados proporcionalmente apenas dos sócios/empresários — o artista não participa.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#534AB7] text-white">
              {investments.length} {investments.length === 1 ? "item" : "itens"} · {fmtBRL(totals.totalInvestimentos)}
            </span>
            {!readonly && (
              <Button size="sm" variant="outline" onClick={addInvestment}><Plus className="h-3.5 w-3.5 mr-1" />Adicionar investimento</Button>
            )}
          </div>
        </div>
        <div className="p-4">

        {pendingInvestments.length > 0 && !readonly && (
          <div className="mb-3 p-3 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 text-sm">
            <p className="font-medium mb-2">
              Há {pendingInvestments.length} investimento(s) parcelado(s) com saldo pendente. Deseja incluir neste fechamento?
            </p>
            <div className="space-y-2">
              {pendingInvestments.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs">
                    {p.descricao} — {p.parcelas_pagas}/{p.total_parcelas} pagas — parcela: {fmtBRL(p.valor_por_parcela)}
                  </span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="default" onClick={() => addPendingInvestment(p)}>Sim, incluir</Button>
                    <Button size="sm" variant="ghost"
                      onClick={() => setPendingInvestments((arr) => arr.filter((x) => x.id !== p.id))}>
                      Ignorar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {investments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum investimento neste fechamento.</p>
        ) : (
          <div className="space-y-2">
            {investments.map((inv) => (
              <div key={inv.id} className="rounded-md border p-3 space-y-2">
                <div className="grid grid-cols-12 gap-2 items-center">
                  <Input className="col-span-5" placeholder="Descrição (ex: Microfone Shure SM58)"
                    value={inv.descricao} disabled={readonly}
                    onChange={(e) => updateInvestment(inv.id, { descricao: e.target.value })} />
                  <Select value={inv.categoria} onValueChange={(v) => updateInvestment(inv.id, { categoria: v })} disabled={readonly}>
                    <SelectTrigger className="col-span-2"><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIAS_INVEST.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input type="date" className="col-span-2" value={inv.data_compra ?? ""} disabled={readonly}
                    onChange={(e) => updateInvestment(inv.id, { data_compra: e.target.value })} />
                  <CurrencyInput className="col-span-2 text-right" value={inv.valor_total} disabled={readonly}
                    onValueChange={(v) => updateInvestment(inv.id, { valor_total: v })} />
                  {!readonly && (
                    <Button size="icon" variant="ghost" className="col-span-1 text-destructive"
                      onClick={() => removeInvestment(inv.id)}><Trash2 className="h-4 w-4" /></Button>
                  )}
                </div>
                <div className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-3 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Parcelas:</span>
                    <Input type="number" min={1} className="h-8" value={inv.total_parcelas} disabled={readonly}
                      onChange={(e) => updateInvestment(inv.id, { total_parcelas: Math.max(1, Number(e.target.value) || 1) })} />
                  </div>
                  <div className="col-span-3 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Nº parcela:</span>
                    <Input type="number" min={1} className="h-8" value={inv.numero_parcela} disabled={readonly}
                      onChange={(e) => updateInvestment(inv.id, { numero_parcela: Math.max(1, Number(e.target.value) || 1) })} />
                  </div>
                  <div className="col-span-3 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">A descontar:</span>
                    <CurrencyInput className="h-8 text-right" value={inv.valor_descontado} disabled={readonly}
                      onValueChange={(v) => updateInvestment(inv.id, { valor_descontado: v })} />
                  </div>
                  <Input className="col-span-3 h-8" placeholder="Observações" value={inv.observacoes ?? ""} disabled={readonly}
                    onChange={(e) => updateInvestment(inv.id, { observacoes: e.target.value })} />
                </div>
              </div>
            ))}
            <div className="flex justify-end pt-2 text-sm font-medium">
              Total investimentos a descontar: {fmtBRL(totals.totalInvestimentos)}
            </div>
          </div>
        )}
        </div>
      </Card>

      {/* Seção E — Despesas Semanais */}
      <Card className="shadow-soft overflow-hidden border-l-[3px] border-l-[#DB2777] animate-fade-in">
        <div className="px-4 py-3 bg-pink-50/70 dark:bg-pink-950/20 border-b flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="font-semibold flex items-center gap-2">
              <span>🎬</span> E. Despesas Semanais
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Despesas adicionais da semana (clipe, marketing, viagens etc.). Use "Desconto de" para definir quem paga.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#DB2777] text-white">
              {clipes.length} {clipes.length === 1 ? "lançamento" : "lançamentos"} · {fmtBRL(totals.totalClipe)}
            </span>
            {!readonly && (
              <Button size="sm" variant="outline" onClick={addClipe}>
                <Plus className="h-3.5 w-3.5 mr-1" />Adicionar despesa semanal
              </Button>
            )}
          </div>
        </div>
        <div className="p-4">
        {clipes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma despesa semanal lançada.</p>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-14 gap-2 px-2 text-xs text-muted-foreground uppercase tracking-wider" style={{ gridTemplateColumns: "repeat(14, minmax(0, 1fr))" }}>
              <div className="col-span-3">Profissional / Beneficiário</div>
              <div className="col-span-3">Descrição</div>
              <div className="col-span-2">Categoria</div>
              <div className="col-span-2 text-right">Valor</div>
              <div className="col-span-3">Desconto de</div>
              <div className="col-span-1" />
            </div>
            {clipes.map((c) => (
              <div key={c.id} className="grid gap-2 items-center rounded-md border p-2" style={{ gridTemplateColumns: "repeat(14, minmax(0, 1fr))" }}>
                <Input className="col-span-3 h-8" placeholder="Nome" value={c.profissional} disabled={readonly}
                  onChange={(e) => updateClipe(c.id, { profissional: e.target.value })} />
                <Input className="col-span-3 h-8" placeholder="Descrição" value={c.clipe} disabled={readonly}
                  onChange={(e) => updateClipe(c.id, { clipe: e.target.value })} />
                <Select value={c.categoria} disabled={readonly}
                  onValueChange={(v) => updateClipe(c.id, { categoria: v })}>
                  <SelectTrigger className="col-span-2 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS_DESPESA_SEMANAL.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <CurrencyInput className="col-span-2 h-8 text-right" value={Number(c.quantidade || 0) * Number(c.valor_por_clipe || 0)} disabled={readonly}
                  onValueChange={(v) => updateClipe(c.id, { quantidade: 1, valor_por_clipe: v })} />
                <Select value={c.desconto_de} disabled={readonly}
                  onValueChange={(v) => updateClipe(c.id, { desconto_de: v as DescontoDe })}>
                  <SelectTrigger className="col-span-3 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(DESCONTO_DE_LABEL) as DescontoDe[]).map((k) => (
                      <SelectItem key={k} value={k}>{DESCONTO_DE_LABEL[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!readonly && (
                  <Button size="icon" variant="ghost" className="col-span-1 h-8 w-8 text-destructive"
                    onClick={() => removeClipe(c.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
            <div className="flex justify-end pt-2 text-sm font-medium">
              TOTAL DESPESAS SEMANAIS: {fmtBRL(totals.totalClipe)}
            </div>
          </div>
        )}
        </div>
      </Card>

      {/* Seção F — Cálculo */}
      <Card className="p-4 shadow-soft bg-muted/20">
        <h2 className="font-semibold mb-3">F. Cálculo automático</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1.5 text-sm">
            <Linha label="Total cachê bruto" value={totals.totalBruto} />
            <Linha label={`(-) Imposto (${config.imposto_percentual.toFixed(2)}%)`} value={-totals.totalImpostos} />
            <Linha label="(-) Comissão vendedores" value={-totals.totalComissoes} />
            <Linha label="(-) Custo equipe" value={-totals.totalEquipe} />
            <Linha label="(-) Van" value={-totals.totalVan} />
            <Linha label="(-) Despesas dos shows" value={-totals.totalDespesasShows} />
            <Linha label="(-) Despesas semanais (todos)" value={-totals.totalDespesasSemanaisTodos} />
            {totals.totalDespesasSemanaisSocios > 0 && (
              <Linha label="(-) Desp. semanais (sócios)" value={-totals.totalDespesasSemanaisSocios} />
            )}
            {totals.totalDespesasSemanaisArtista > 0 && (
              <Linha label="(-) Desp. semanais (artista)" value={-totals.totalDespesasSemanaisArtista} />
            )}
            <div className="border-t pt-2 mt-2 font-semibold flex justify-between">
              <span>(=) SOBRA PARA DISTRIBUIR</span>
              <span>{fmtBRL(totals.sobraDistribuir)}</span>
            </div>
            {(() => {
              const somaDist = totals.distribution.reduce((a, r) => a + r.valor_bruto, 0);
              const diff = Math.abs(somaDist - totals.sobraDistribuir);
              if (diff > 0.05) {
                console.error("ERRO DE CÁLCULO: soma distribuída não bate com a sobra", {
                  soma_distribuida: somaDist, sobra: totals.sobraDistribuir, diferenca: diff,
                });
                return (
                  <div className="mt-2 rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-xs text-destructive font-medium">
                    ⚠️ Erro de cálculo detectado. Contate o suporte.
                  </div>
                );
              }
              return null;
            })()}
          </div>

          <div className="space-y-2 text-sm">
            <h3 className="font-medium uppercase text-xs tracking-wider text-muted-foreground">Distribuição final por participante</h3>
            {totals.distribution.length === 0 ? (
              <p className="text-muted-foreground">Configure a distribuição financeira do artista.</p>
            ) : (
              totals.distribution.map((d, i) => (
                <div key={i} className="rounded border bg-background p-2 space-y-0.5">
                  <div className="flex justify-between font-medium">
                    <span>{d.beneficiario} ({d.percentual.toFixed(2)}%)</span>
                    <span className="text-base">{fmtBRL(d.valor_liquido)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <div className="flex justify-between"><span>Bruto (% da sobra)</span><span>{fmtBRL(d.valor_bruto)}</span></div>
                    {d.investimento_valor > 0 && (
                      <div className="flex justify-between"><span>(-) Investimentos</span><span>{fmtBRL(d.investimento_valor)}</span></div>
                    )}
                    {(d.despesas_semanais_valor ?? 0) > 0 && (
                      <div className="flex justify-between">
                        <span>(-) {d.tipo === "artista" ? "Desp. pessoais" : "Desp. semanais"}</span>
                        <span>{fmtBRL(d.despesas_semanais_valor ?? 0)}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            <div className="border-t pt-2 text-xs text-muted-foreground space-y-0.5">
              <div className="flex justify-between"><span>Total impostos</span><span>{fmtBRL(totals.totalImpostos)}</span></div>
              <div className="flex justify-between"><span>Total investimentos</span><span>{fmtBRL(totals.totalInvestimentos)}</span></div>
              <div className="flex justify-between font-semibold text-foreground"><span>Total líquido distribuído</span><span>{fmtBRL(totals.totalLiquido)}</span></div>
            </div>
          </div>
        </div>
      </Card>

      {/* Observações */}
      <Card className="p-4 shadow-soft">
        <h2 className="font-semibold mb-3">Observações</h2>
        <Textarea rows={4} value={observacoes} disabled={readonly}
          onChange={(e) => setObservacoes(e.target.value)} placeholder="Anotações deste fechamento..." />
      </Card>

      {canEdit && (
        <div className="flex justify-end pt-2">
          <Button variant="destructive" onClick={() => setOpenDelete(true)}>
            <Trash2 className="h-4 w-4 mr-2" />
            Excluir fechamento
          </Button>
        </div>
      )}

      <DeleteClosingDialog
        open={openDelete}
        onOpenChange={setOpenDelete}
        closing={closing ? {
          id: closing.id,
          semana_inicio: closing.semana_inicio,
          semana_fim: closing.semana_fim,
          status: closing.status,
          artistName,
        } : null}
        onDeleted={() => navigate("/fechamento")}
      />
    </div>
    </TooltipProvider>
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

function ResumoBox({ label, value, accent }: { label: string; value: number; accent?: "primary" }) {
  return (
    <div className={cn("rounded-lg border p-3", accent === "primary" && "bg-primary/5 border-primary/30")}>
      <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className={cn("text-lg font-semibold mt-1", accent === "primary" && (value >= 0 ? "text-primary" : "text-destructive"))}>{fmtBRL(value)}</div>
    </div>
  );
}

function SummaryCard({
  icon, iconBg, label, value, sub, accent,
}: { icon: string; iconBg: string; label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border bg-card shadow-soft p-4 transition-all hover:shadow-elevated">
      <div className="flex items-start gap-3">
        <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center text-lg shrink-0", iconBg)}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
          <div className={cn("text-xl font-bold mt-0.5 truncate", accent && "text-[#00C853]")}>{value}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>
        </div>
      </div>
    </div>
  );
}
