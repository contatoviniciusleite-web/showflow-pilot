import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { CurrencyInput } from "@/components/ui/currency-input";
import { TitleCaseInput } from "@/components/ui/title-case-input";
import { formatCEP, formatCpfCnpj, formatPhoneBR, toTitleCase } from "@/lib/masks";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, FileText, Check, X, Upload, Eye, CheckCircle2, Ban, CalendarClock, History, Link as LinkIcon, Copy, MessageCircle } from "lucide-react";
import { STATUS_CLASS, STATUS_LABEL } from "@/lib/showStatus";
import { lazy, Suspense } from "react";
const ShowDetailsModal = lazy(() => import("@/components/shows/ShowDetailsModal").then(m => ({ default: m.ShowDetailsModal })));
import { PaymentScheduleRows, type ScheduleItem } from "@/components/shows/PaymentScheduleEditor";
import { canConfirmPayment } from "@/lib/permissions";
import {
  ShowsFilters,
  applyFilters,
  defaultFilters,
  filtersFromParams,
  filtersToParams,
  type FiltersState,
} from "@/components/shows/ShowsFilters";

interface ArtistLite { id: string; nome: string; cor: string; cache_minimo?: number; }
type ShowStatus = "pendente" | "rejeitada" | "aprovada" | "aguardando_pagamento" | "confirmado" | "cancelada";
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
  autorizado_por_nome?: string | null;
  autorizado_em?: string | null;
  cancelado_em?: string | null;
  cancelado_motivo?: string | null;
  data_show_original?: string | null;
  horario_original?: string | null;
  remarcado_count?: number | null;
  ultima_remarcacao_em?: string | null;
  ultima_remarcacao_motivo?: string | null;
  confirmado_por_nome?: string | null;
  confirmado_em?: string | null;
  contratante_link_token?: string | null;
  contratante_link_expires_at?: string | null;
  contratante_link_preenchido?: boolean | null;
  comprovante_url?: string | null;
  prazo_comprovante_em?: string | null;
  confirmado_sem_pagamento?: boolean | null;
  confirmado_sem_pagamento_motivo?: string | null;
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
  cache_total: 0 as number,
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
  autorizado_por: "",
  contratante_id: "" as string,
};

// ETAPA 1: campos básicos exigidos do vendedor.
const BASIC_REQUIRED = ["artist_id", "data_show", "horario", "local", "cidade", "cache_total"] as const;
// ETAPA 3: dados completos exigidos para enviar à etapa de pagamento.
const FULL_REQUIRED = [
  ...BASIC_REQUIRED,
  "condicao_pagamento",
  "contratante_nome",
  "contratante_telefone",
  "contratante_email",
] as const;

const FIELD_LABELS: Record<string, string> = {
  artist_id: "Artista",
  data_show: "Data do show",
  horario: "Horário",
  local: "Nome do local",
  cidade: "Cidade",
  cache_total: "Cachê total",
  condicao_pagamento: "Condição de pagamento",
  contratante_nome: "Nome do contratante",
  contratante_telefone: "Telefone do contratante",
  contratante_email: "E-mail do contratante",
};

function validateBasic(form: FormState): Record<string, string> {
  const errs: Record<string, string> = {};
  for (const f of BASIC_REQUIRED) {
    const v = (form as any)[f];
    if (v === null || v === undefined || v === "" || (typeof v === "number" && v <= 0)) {
      errs[f] = "Este campo é obrigatório";
    }
  }
  return errs;
}

function validateFull(form: FormState): Record<string, string> {
  const errs: Record<string, string> = {};
  for (const f of FULL_REQUIRED) {
    const v = (form as any)[f];
    if (v === null || v === undefined || v === "" || (typeof v === "number" && v <= 0)) {
      errs[f] = "Este campo é obrigatório";
    }
  }
  if (form.contratante_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contratante_email)) {
    errs.contratante_email = "E-mail inválido";
  }
  return errs;
}

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
  const queryClient = useQueryClient();
  const isManager = roles.includes("gerente");
  const isDiretor = roles.includes("diretor");
  const isStaff = roles.includes("equipe");
  const isVendedor = roles.includes("vendedor");
  const isArtista = roles.includes("artista");
  const isFinanceiro = roles.includes("financeiro");
  const isEditor = isManager || isStaff || isDiretor;
  const canCreate = isManager || isStaff || isVendedor || isDiretor;
  const canApproveReject = isDiretor; // somente Diretor aprova/rejeita

  const uploadComprovante = async (s: Show) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/pdf,image/png,image/jpeg,image/jpg";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const allowed = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];
      if (!allowed.includes(file.type)) {
        return toast.error("Formato inválido. Use PDF, JPG, JPEG ou PNG.");
      }
      if (file.size > 10 * 1024 * 1024) {
        return toast.error("Arquivo excede 10MB.");
      }
      const ext = (file.name.split(".").pop() ?? "bin").toLowerCase();
      const slug = (s.artist_nome ?? "artista")
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const path = `${s.id}/${slug}-${s.data_show}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("comprovantes").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (upErr) return toast.error(upErr.message);
      const { error } = await supabase.functions.invoke("shows-admin", {
        body: {
          action: "add_attachment",
          show_id: s.id,
          path,
          file_name: file.name,
          mime_type: file.type,
          size_bytes: file.size,
          tipo: "comprovante",
        },
      });
      if (error) return toast.error(error.message);
      toast.success("Comprovante anexado");
      load();
    };
    input.click();
  };

  const [details, setDetails] = useState<Show | null>(null);
  const openDetails = (s: Show) => setDetails(s);
  const canConfirm = canConfirmPayment(roles);



  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Show | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [parcelas, setParcelas] = useState<ScheduleItem[]>([]);
  const [myName, setMyName] = useState<string>("");

  // Janela de carregamento (limita o volume vindo do servidor para evitar travas).
  // "default" = últimos 90 dias + próximos 180 dias. "year" = ano corrente. "all" = sem limite.
  const [loadRange, setLoadRange] = useState<"default" | "year" | "all" | "custom">("default");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");

  const rangeBody = useMemo(() => {
    if (loadRange === "all") return { range: "all" as const };
    if (loadRange === "year") {
      const y = new Date().getFullYear();
      return { from: `${y}-01-01`, to: `${y}-12-31` };
    }
    if (loadRange === "custom" && (customFrom || customTo)) {
      return { from: customFrom || undefined, to: customTo || undefined };
    }
    return {}; // default = backend aplica janela padrão
  }, [loadRange, customFrom, customTo]);

  const showsQuery = useQuery({
    queryKey: ["shows", user?.id, roles.join(","), "bootstrap-v1", loadRange, customFrom, customTo],
    queryFn: async () => {
      const res = await supabase.functions.invoke("shows-admin", { body: { action: "bootstrap", ...rangeBody } });
      if (res.error) throw new Error(res.error.message);
    return {
      shows: (res.data?.shows ?? []) as Show[],
      artists: (res.data?.artists ?? []) as ArtistLite[],
    };
    },
    enabled: !!user?.id,
  });
  const shows = showsQuery.data?.shows ?? [];
  const artists = showsQuery.data?.artists ?? [];
  const loading = showsQuery.isLoading;

  // Carrega o nome do usuário logado para autopreencher "Vendedor responsável"
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("nome")
        .eq("id", user.id)
        .maybeSingle();
      const metaNome = (user.user_metadata as any)?.nome as string | undefined;
      const fallback = user.email?.split("@")[0] ?? "";
      setMyName(
        (data?.nome && data.nome.trim()) ||
        (metaNome && metaNome.trim()) ||
        fallback
      );
    })();
  }, [user?.id, user?.email]);

  // Rejeição
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<Show | null>(null);
  const [rejectMotivo, setRejectMotivo] = useState("");

  // Cancelamento
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Show | null>(null);
  const [cancelMotivo, setCancelMotivo] = useState("");
  const [cancelling, setCancelling] = useState(false);

  // Remarcação
  const [reschedOpen, setReschedOpen] = useState(false);
  const [reschedTarget, setReschedTarget] = useState<Show | null>(null);
  const [reschedData, setReschedData] = useState("");
  const [reschedHora, setReschedHora] = useState("");
  const [reschedMotivo, setReschedMotivo] = useState("");
  const [rescheduling, setRescheduling] = useState(false);

  // Histórico de remarcações
  const [histOpen, setHistOpen] = useState(false);
  const [histTarget, setHistTarget] = useState<Show | null>(null);
  const [histRows, setHistRows] = useState<any[]>([]);
  const [histLoading, setHistLoading] = useState(false);

  // Link do contratante
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkData, setLinkData] = useState<{ token: string; expiresAt: string; show: Show | null } | null>(null);
  const [linkCountdown, setLinkCountdown] = useState("");
  const [generatingLink, setGeneratingLink] = useState(false);

  useEffect(() => {
    if (!linkData?.expiresAt) return;
    const tick = () => {
      const ms = new Date(linkData.expiresAt).getTime() - Date.now();
      if (ms <= 0) { setLinkCountdown("Expirado"); return; }
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setLinkCountdown(`${h}h ${m}m ${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [linkData?.expiresAt]);

  const buildLink = (token: string) => `${window.location.origin}/minuta/${token}`;

  const generateContratanteLink = async () => {
    if (!editing) {
      toast.error("Salve a minuta básica primeiro e aguarde a aprovação para gerar o link.");
      return;
    }
    setGeneratingLink(true);
    try {
      const { data, error } = await supabase.functions.invoke("shows-admin", {
        body: { action: "generate_contratante_link", id: editing.id },
      });
      if (error) throw error;
      const sh = data?.show;
      if (!sh?.contratante_link_token) throw new Error("Token não gerado");
      setOpen(false);
      setLinkData({
        token: sh.contratante_link_token,
        expiresAt: sh.contratante_link_expires_at,
        show: { ...editing, status: "aprovada" } as Show,
      });
      setLinkOpen(true);
      load();
    } catch (e: any) {
      const Sentry = await import("@sentry/react");
      Sentry.captureException(e, {
        tags: { action: "generate_contratante_link", show_id: editing?.id ?? "" },
      });
      toast.error(e?.message ?? "Erro ao gerar link");
    } finally {
      setGeneratingLink(false);
    }
  };

  const cancelContratanteLink = async (s: Show) => {
    if (!confirm("Cancelar o link do contratante? A minuta voltará a 'Aguardando Dados' para você preencher manualmente.")) return;
    const { error } = await supabase.functions.invoke("shows-admin", {
      body: { action: "cancel_contratante_link", id: s.id },
    });
    if (error) return toast.error(error.message);
    toast.success("Link cancelado.");
    load();
  };

  const copyLink = async () => {
    if (!linkData) return;
    await navigator.clipboard.writeText(buildLink(linkData.token));
    toast.success("Link copiado!");
  };

  const shareWhatsApp = () => {
    if (!linkData) return;
    const link = buildLink(linkData.token);
    const msg = `Olá! Para confirmarmos o show, preciso que você preencha seus dados neste link: ${link}. O link expira em 24 horas.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const load = async () => {
    await showsQuery.refetch();
  };

  // Pré-popula nova minuta a partir da agenda (?new=1&artist=...&data=...)
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get("new") !== "1") return;
    if (!artists.length) return; // espera carregar
    const artistId = searchParams.get("artist") ?? "";
    const data = searchParams.get("data") ?? "";
    setEditing(null);
    setForm({ ...emptyForm, artist_id: artistId, data_show: data });
    setParcelas([]);
    setOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete("new"); next.delete("artist"); next.delete("data");
    setSearchParams(next, { replace: true });
  }, [searchParams, artists.length]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setParcelas([]);
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
      cache_total: Number(s.cache_total ?? 0),
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
      autorizado_por: s.autorizado_por ?? "",
      contratante_id: (s as any).contratante_id ?? "",
    });
    setOpen(true);
    // carrega parcelas existentes
    supabase.functions.invoke("shows-admin", {
      body: { action: "list_payment_schedule", show_id: s.id },
    }).then(({ data, error }) => {
      if (error) { setParcelas([]); return; }
      const items = (data?.schedule ?? []).map((r: any, i: number) => ({
        id: r.id,
        ordem: r.ordem ?? i,
        descricao: r.descricao ?? "",
        data_prevista: r.data_prevista ?? "",
        percentual: r.percentual === null ? null : Number(r.percentual),
        valor: Number(r.valor ?? 0),
        observacoes: r.observacoes ?? "",
      }));
      setParcelas(items);
    });
  };

  const [errors, setErrors] = useState<Record<string, string>>({});

  const selectedArtist = artists.find((a) => a.id === form.artist_id);
  const cacheMin = Number(selectedArtist?.cache_minimo ?? 0);
  const cacheBelowMin = cacheMin > 0 && Number(form.cache_total) > 0 && Number(form.cache_total) < cacheMin;

  // Modo do formulário: básico (criação ou edição em pendente/rejeitada) ou completo (etapa 3+).
  const isCompleteMode = !!editing && ["aprovada", "aguardando_pagamento", "confirmado"].includes(editing.status);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = isCompleteMode ? validateFull(form) : validateBasic(form);
    if (Object.keys(errs).length) {
      setErrors(errs);
      const first = Object.keys(errs)[0];
      toast.error(`Preencha: ${FIELD_LABELS[first] ?? first}`);
      const el = document.querySelector<HTMLElement>(`[data-field="${first}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (cacheBelowMin && !isManager) {
      toast.error(
        `O cachê informado (${fmtBRL(Number(form.cache_total))}) está abaixo do mínimo permitido para este artista (${fmtBRL(cacheMin)}). Somente a gerência pode autorizar valores abaixo do mínimo.`,
      );
      const el = document.querySelector<HTMLElement>(`[data-field="cache_total"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const payload = {
        ...form,
        vendedor: myName || form.vendedor,
        capacidade: form.capacidade === "" ? null : Number(form.capacidade),
        cache_total: Number(form.cache_total) || 0,
      };
      // Decidir action:
      //  - editar minuta em aguardando_dados (vendedor dono): complete_data → vai para aguardando_pagamento
      //  - gerência/equipe editando: update (preserva status)
      //  - nova minuta: create
      let action: "create" | "update" | "complete_data";
      if (!editing) action = "create";
      else if (editing.status === "aprovada") action = "complete_data";
      else action = "update";

      const { data: saveData, error } = await supabase.functions.invoke("shows-admin", {
        body: editing ? { action, id: editing.id, show: payload } : { action, show: payload },
      });
      if (error) throw error;

      // Persiste cronograma de pagamento (parcelas)
      const savedShowId = editing?.id ?? (saveData as any)?.show?.id;
      if (savedShowId) {
        const items = parcelas.map((it, i) => ({ ...it, ordem: i }));
        const { error: schedErr } = await supabase.functions.invoke("shows-admin", {
          body: { action: "save_payment_schedule", show_id: savedShowId, items },
        });
        if (schedErr) console.error("save_payment_schedule", schedErr);
      }

      if (cacheBelowMin && isManager) {
        toast.warning(`Cachê abaixo do mínimo (${fmtBRL(cacheMin)}). Salvo como exceção pela gerência.`);
      }
      const successMsg = action === "create" ? "Minuta enviada para aprovação"
        : action === "complete_data" ? "Dados completos enviados — aguardando comprovante do sinal"
        : "Minuta atualizada";
      toast.success(successMsg);
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

  // ===== Optimistic update helper =====
  // Aplica patch local imediatamente; em caso de erro, reverte e re-fetch.
  const showsQueryKey = ["shows", user?.id, roles.join(","), "bootstrap-v1", loadRange, customFrom, customTo];
  const optimisticUpdate = async (
    showId: string,
    patch: Partial<Show>,
    invoke: () => Promise<{ error: any }>,
    successMsg: string,
  ) => {
    const prev = queryClient.getQueryData<any>(showsQueryKey);
    queryClient.setQueryData(showsQueryKey, (old: any) => {
      if (!old) return old;
      return {
        ...old,
        shows: (old.shows ?? []).map((s: Show) => (s.id === showId ? { ...s, ...patch } : s)),
      };
    });
    const { error } = await invoke();
    if (error) {
      // Rollback
      if (prev) queryClient.setQueryData(showsQueryKey, prev);
      toast.error(error.message ?? "Erro ao atualizar");
      queryClient.invalidateQueries({ queryKey: showsQueryKey });
      return false;
    }
    toast.success(successMsg);
    // Garante consistência (campos derivados, notificações etc.)
    queryClient.invalidateQueries({ queryKey: showsQueryKey });
    return true;
  };

  const approve = async (s: Show) => {
    if (!confirm(`Aprovar minuta de ${s.artist_nome ?? "show"}?`)) return;
    await optimisticUpdate(
      s.id,
      { status: "aprovada" as ShowStatus },
      () => supabase.functions.invoke("shows-admin", { body: { action: "approve", id: s.id } }),
      "Minuta aprovada — vendedor notificado",
    );
  };

  const openReject = (s: Show) => {
    setRejectTarget(s);
    setRejectMotivo("");
    setRejectOpen(true);
  };
  const confirmReject = async () => {
    if (!rejectTarget) return;
    if (!rejectMotivo.trim()) return toast.error("Informe o motivo da rejeição");
    const target = rejectTarget;
    setRejectOpen(false);
    setRejectTarget(null);
    await optimisticUpdate(
      target.id,
      { status: "rejeitada" as ShowStatus },
      () => supabase.functions.invoke("shows-admin", {
        body: { action: "reject", id: target.id, motivo: rejectMotivo.trim() },
      }),
      "Minuta rejeitada — vendedor notificado",
    );
  };

  // ===== Cancelamento =====
  const openCancel = (s: Show) => {
    setCancelTarget(s);
    setCancelMotivo("");
    setCancelOpen(true);
  };
  const confirmCancel = async () => {
    if (!cancelTarget) return;
    if (!cancelMotivo.trim()) return toast.error("Informe o motivo do cancelamento");
    const target = cancelTarget;
    const motivo = cancelMotivo.trim();
    setCancelling(true);
    setCancelOpen(false);
    setCancelTarget(null);
    await optimisticUpdate(
      target.id,
      { status: "cancelada" as ShowStatus, cancelado_motivo: motivo, cancelado_em: new Date().toISOString() },
      () => supabase.functions.invoke("shows-admin", {
        body: { action: "cancel", id: target.id, motivo },
      }),
      "Show cancelado — usuários notificados",
    );
    setCancelling(false);
  };

  // ===== Remarcação =====
  const openReschedule = (s: Show) => {
    if (s.status === "cancelada") {
      toast.error("Show cancelado não pode ser remarcado");
      return;
    }
    setReschedTarget(s);
    setReschedData(s.data_show ?? "");
    setReschedHora(s.horario ? s.horario.slice(0, 5) : "");
    setReschedMotivo("");
    setReschedOpen(true);
  };
  const confirmReschedule = async () => {
    if (!reschedTarget) return;
    if (!reschedData) return toast.error("Informe a nova data");
    if (!reschedHora) return toast.error("Informe o novo horário");
    if (!reschedMotivo.trim()) return toast.error("Informe o motivo da remarcação");
    const target = reschedTarget;
    const novaData = reschedData;
    const novoHora = reschedHora;
    const motivo = reschedMotivo.trim();
    setRescheduling(true);
    setReschedOpen(false);
    setReschedTarget(null);
    await optimisticUpdate(
      target.id,
      {
        data_show: novaData,
        horario: `${novoHora}:00`,
        ultima_remarcacao_motivo: motivo,
        ultima_remarcacao_em: new Date().toISOString(),
        remarcado_count: (target.remarcado_count ?? 0) + 1,
      },
      () => supabase.functions.invoke("shows-admin", {
        body: { action: "reschedule", id: target.id, nova_data: novaData, novo_horario: novoHora, motivo },
      }),
      "Show remarcado — usuários notificados",
    );
    setRescheduling(false);
  };

  // ===== Histórico =====
  const openHistory = async (s: Show) => {
    setHistTarget(s);
    setHistOpen(true);
    setHistLoading(true);
    const { data, error } = await supabase.functions.invoke("shows-admin", {
      body: { action: "list_reschedules", id: s.id },
    });
    setHistLoading(false);
    if (error) return toast.error(error.message);
    setHistRows((data?.reschedules ?? []) as any[]);
  };

  // Filtros (com persistência via URL)
  const filters: FiltersState = useMemo(
    () => filtersFromParams(searchParams),
    [searchParams],
  );
  const setFilters = (next: FiltersState) => {
    const newParams = filtersToParams(next);
    // preserva params não relacionados a filtro (ex: ?new=1)
    searchParams.forEach((v, k) => {
      if (!["artista", "periodo", "status", "de", "ate"].includes(k)) {
        newParams.set(k, v);
      }
    });
    setSearchParams(newParams, { replace: true });
  };

  const filteredShows = useMemo(() => applyFilters(shows, filters), [shows, filters]);

  // Lista de artistas para o dropdown — respeita as permissões do RLS:
  // o backend já entrega `artists` apenas com os que o usuário pode ver.
  // Para vendedor, restringimos ainda aos artistas presentes nas próprias minutas.
  const artistsForFilter = useMemo(() => {
    if (isVendedor && !isEditor && !isFinanceiro) {
      const ids = new Set(shows.map((s) => s.artist_id));
      return artists.filter((a) => ids.has(a.id));
    }
    return artists;
  }, [artists, shows, isVendedor, isEditor, isFinanceiro]);

  const upcoming = useMemo(
    () => filteredShows.filter((s) => s.data_show >= new Date().toISOString().slice(0, 10)).length,
    [filteredShows],
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

      {/* Janela de carregamento (limita o volume vindo do servidor) */}
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <div className="min-w-[220px]">
          <Label className="text-xs">Carregar</Label>
          <Select value={loadRange} onValueChange={(v) => setLoadRange(v as any)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Últimos 90 dias + próximos 180 dias</SelectItem>
              <SelectItem value="year">Este ano inteiro</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
              <SelectItem value="all">Todos os shows</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {loadRange === "custom" && (
          <>
            <div>
              <Label className="text-xs">De</Label>
              <Input type="date" className="h-9 w-[150px]" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Até</Label>
              <Input type="date" className="h-9 w-[150px]" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
            </div>
          </>
        )}
      </div>

      {!loading && shows.length > 0 && (
        <ShowsFilters
          filters={filters}
          onChange={setFilters}
          artists={artistsForFilter}
          hideArtist={isArtista && !isEditor && !isFinanceiro && !isVendedor}
          total={shows.length}
          filteredCount={filteredShows.length}
        />
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-5 shadow-soft space-y-3">
              <div className="h-5 w-1/2 bg-muted rounded animate-pulse" />
              <div className="h-4 w-1/3 bg-muted rounded animate-pulse" />
              <div className="h-4 w-2/3 bg-muted rounded animate-pulse" />
              <div className="h-8 w-24 bg-muted rounded animate-pulse" />
            </Card>
          ))}
        </div>
      ) : shows.length === 0 ? (
        <Card className="p-12 text-center shadow-soft">
          <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground mb-4">Nenhuma minuta cadastrada ainda.</p>
          {canCreate && <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Criar primeira minuta</Button>}
        </Card>
      ) : filteredShows.length === 0 ? (
        <Card className="p-12 text-center shadow-soft">
          <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Nenhuma minuta corresponde aos filtros aplicados.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredShows.map((s) => (
            <Card key={s.id} className="p-5 shadow-soft">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.artist_cor ?? "#888" }} />
                    <h3 className="font-semibold truncate">{s.artist_nome ?? "—"}</h3>
                    <StatusBadge status={s.status} />
                    {s.confirmado_sem_pagamento && (isDiretor || isFinanceiro) && (
                      <Badge variant="outline" className="text-xs border-yellow-500/50 text-yellow-700 dark:text-yellow-400" title={s.confirmado_sem_pagamento_motivo ?? ""}>
                        🤝 Sem pagamento
                      </Badge>
                    )}
                    {s.status === "aprovada" && !s.contratante_nome && !s.contratante_link_token && (
                      <Badge variant="outline" className="text-xs">⏳ Aguardando dados</Badge>
                    )}
                    {s.status === "aprovada" && s.contratante_link_token && !s.contratante_link_preenchido && (
                      <Badge variant="outline" className="text-xs">📩 Link enviado</Badge>
                    )}
                    {s.status === "aprovada" && s.contratante_nome && s.condicao_pagamento && (
                      <Badge variant="outline" className="text-xs">✅ Dados completos</Badge>
                    )}
                    {s.status === "aguardando_pagamento" && s.comprovante_url && (
                      <Badge variant="outline" className="text-xs">📎 Comprovante enviado</Badge>
                    )}
                    {s.status === "aguardando_pagamento" && s.prazo_comprovante_em &&
                      new Date(s.prazo_comprovante_em).getTime() - Date.now() < 12 * 3600 * 1000 &&
                      new Date(s.prazo_comprovante_em).getTime() > Date.now() && (
                        <Badge variant="outline" className="text-xs text-amber-600 border-amber-500">⚠️ Vence em breve</Badge>
                      )}
                    {(s.remarcado_count ?? 0) > 0 && (
                      <Badge className="bg-amber-500 hover:bg-amber-500 text-white">REMARCADO</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {fmtDate(s.data_show)}{s.horario ? ` · ${s.horario.slice(0, 5)}` : ""}
                  </p>
                  {(s.remarcado_count ?? 0) > 0 && s.data_show_original && (
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                      Data original: {fmtDate(s.data_show_original)}
                      {s.horario_original ? ` · ${String(s.horario_original).slice(0, 5)}` : ""}
                    </p>
                  )}
                  <p className="text-sm mt-1 truncate">{s.local ?? "Local não informado"}{s.cidade ? ` — ${s.cidade}` : ""}</p>
                  <p className="text-sm font-medium mt-2">{fmtBRL(Number(s.cache_total ?? 0))}</p>
                  {s.contratante_nome && <p className="text-xs text-muted-foreground mt-1 truncate">Contratante: {s.contratante_nome}</p>}
                  {s.vendedor && <p className="text-xs text-muted-foreground mt-1 truncate">Vendedor: {s.vendedor}</p>}
                  {s.status === "cancelada" && (
                    <div className="mt-2 rounded-md border border-destructive/40 bg-destructive/10 p-2">
                      {(isManager || isFinanceiro || isArtista) && s.cancelado_motivo ? (
                        <p className="text-xs text-destructive">
                          <span className="font-semibold">Motivo do cancelamento:</span> {s.cancelado_motivo}
                        </p>
                      ) : (
                        <p className="text-xs text-destructive font-semibold">Show Cancelado</p>
                      )}
                    </div>
                  )}
                  {s.status === "rejeitada" && (s as any).rejeitada_motivo && (
                    <div className="mt-2 rounded-md border border-destructive/40 bg-destructive/10 p-2">
                      <p className="text-xs text-destructive">
                        <span className="font-semibold">Motivo da rejeição:</span> {(s as any).rejeitada_motivo}
                      </p>
                    </div>
                  )}
                  {(s.remarcado_count ?? 0) > 0 && s.ultima_remarcacao_motivo && (isManager || isFinanceiro || isArtista) && (
                    <p className="text-xs text-muted-foreground mt-1">
                      <span className="font-semibold">Motivo da remarcação:</span> {s.ultima_remarcacao_motivo}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  {canApproveReject && s.status === "pendente" && (
                    <>
                      <Button size="sm" variant="default" className="bg-green-600 hover:bg-green-700" onClick={() => approve(s)} title="Aprovar">
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => openReject(s)} title="Rejeitar">
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                  {(s.created_by === user?.id || isEditor || isFinanceiro) && s.status !== "cancelada" && (
                    <Button size="sm" variant="outline" onClick={() => uploadComprovante(s)} title="Anexar comprovante">
                      <Upload className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => openDetails(s)} title="Anexos / Financeiro">
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                  {s.contratante_link_token && (s.created_by === user?.id || isEditor) && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        title="Copiar link do contratante"
                        onClick={async () => {
                          await navigator.clipboard.writeText(`${window.location.origin}/minuta/${s.contratante_link_token}`);
                          toast.success("Link copiado!");
                        }}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        title="Cancelar link e preencher manualmente"
                        onClick={() => cancelContratanteLink(s)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                  {s.status === "aguardando_pagamento" && canConfirm && (
                    <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => openDetails(s)} title="Confirmar pagamento">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {s.status === "aprovada" && (s.created_by === user?.id || isEditor) && (
                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => openEdit(s)} title="Completar dados">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {isEditor && s.status !== "cancelada" && s.status !== "aprovada" && (
                    <Button size="sm" variant="outline" onClick={() => openEdit(s)} title="Editar"><Pencil className="h-3.5 w-3.5" /></Button>
                  )}
                  {isManager && s.status !== "cancelada" && (
                    <Button size="sm" variant="outline" onClick={() => openReschedule(s)} title="Remarcar show">
                      <CalendarClock className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {isManager && s.status !== "cancelada" && (
                    <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => openCancel(s)} title="Cancelar show">
                      <Ban className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {(s.remarcado_count ?? 0) > 0 && (isManager || isFinanceiro) && (
                    <Button size="sm" variant="ghost" onClick={() => openHistory(s)} title="Histórico de remarcações">
                      <History className="h-3.5 w-3.5" />
                    </Button>
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

      {/* Modal de cancelamento */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancelar show</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            O show permanecerá na agenda marcado como <strong>CANCELADO</strong>. Todos os usuários vinculados serão notificados.
          </p>
          {cancelTarget && (
            <div className="text-sm rounded-md border p-2 bg-muted/30">
              <div className="font-medium">{cancelTarget.artist_nome ?? "—"}</div>
              <div className="text-muted-foreground">
                {fmtDate(cancelTarget.data_show)}{cancelTarget.horario ? ` · ${cancelTarget.horario.slice(0, 5)}` : ""}
                {cancelTarget.local ? ` — ${cancelTarget.local}` : ""}
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Motivo do cancelamento *</Label>
            <Textarea rows={4} value={cancelMotivo} onChange={(e) => setCancelMotivo(e.target.value)}
              placeholder="Explique por que o show está sendo cancelado..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)} disabled={cancelling}>Voltar</Button>
            <Button variant="destructive" onClick={confirmCancel} disabled={cancelling}>
              {cancelling && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de remarcação */}
      <Dialog open={reschedOpen} onOpenChange={setReschedOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Remarcar show</DialogTitle>
          </DialogHeader>
          {reschedTarget && (
            <div className="text-sm rounded-md border p-2 bg-muted/30">
              <div className="font-medium">{reschedTarget.artist_nome ?? "—"}</div>
              <div className="text-muted-foreground">
                Atual: {fmtDate(reschedTarget.data_show)}
                {reschedTarget.horario ? ` · ${reschedTarget.horario.slice(0, 5)}` : ""}
                {reschedTarget.local ? ` — ${reschedTarget.local}` : ""}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nova data *</Label>
              <Input type="date" value={reschedData} onChange={(e) => setReschedData(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Novo horário *</Label>
              <Input type="time" value={reschedHora} onChange={(e) => setReschedHora(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Motivo da remarcação *</Label>
            <Textarea rows={4} value={reschedMotivo} onChange={(e) => setReschedMotivo(e.target.value)}
              placeholder="Explique por que o show está sendo remarcado..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReschedOpen(false)} disabled={rescheduling}>Voltar</Button>
            <Button onClick={confirmReschedule} disabled={rescheduling}>
              {rescheduling && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar remarcação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Histórico de remarcações */}
      <Dialog open={histOpen} onOpenChange={setHistOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Histórico de remarcações</DialogTitle>
          </DialogHeader>
          {histTarget && (
            <p className="text-sm text-muted-foreground">
              {histTarget.artist_nome ?? "—"}{histTarget.local ? ` · ${histTarget.local}` : ""}
            </p>
          )}
          {histLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : histRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma remarcação registrada.</p>
          ) : (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {histRows.map((r) => (
                <div key={r.id} className="rounded-md border p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">
                      {fmtDate(r.data_anterior)}{r.horario_anterior ? ` ${String(r.horario_anterior).slice(0, 5)}` : ""}
                      {" → "}
                      {fmtDate(r.data_nova)}{r.horario_novo ? ` ${String(r.horario_novo).slice(0, 5)}` : ""}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                    </span>
                  </div>
                  <p className="mt-1 text-muted-foreground"><span className="font-medium text-foreground">Motivo:</span> {r.motivo}</p>
                  {r.remarcado_por_nome && (
                    <p className="text-xs text-muted-foreground mt-1">Por: {r.remarcado_por_nome}</p>
                  )}
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setHistOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de rejeição */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rejeitar minuta</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Ao rejeitar, a minuta ficará marcada como <strong>Rejeitada</strong> e o vendedor será notificado com o motivo.
          </p>
          <div className="space-y-1.5">
            <Label>Motivo *</Label>
            <Textarea rows={4} value={rejectMotivo} onChange={(e) => setRejectMotivo(e.target.value)} placeholder="Explique por que esta minuta está sendo rejeitada..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmReject}>Rejeitar minuta</Button>
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
                <div className="space-y-1.5 sm:col-span-2" data-field="artist_id">
                  <Label>Artista *</Label>
                  <Select value={form.artist_id} onValueChange={(v) => set("artist_id", v)}>
                    <SelectTrigger className={cn(errors.artist_id && "border-destructive")}>
                      <SelectValue placeholder="Selecione o artista" />
                    </SelectTrigger>
                    <SelectContent>
                      {artists.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.artist_id && <p className="text-sm text-destructive">{errors.artist_id}</p>}
                </div>
                <div className="space-y-1.5" data-field="data_show">
                  <Label>Data do show *</Label>
                  <Input type="date" value={form.data_show} onChange={(e) => set("data_show", e.target.value)}
                    className={cn(errors.data_show && "border-destructive")} aria-invalid={!!errors.data_show} />
                  {errors.data_show && <p className="text-sm text-destructive">{errors.data_show}</p>}
                </div>
                <div className="space-y-1.5" data-field="horario">
                  <Label>Horário *</Label>
                  <Input type="time" value={form.horario} onChange={(e) => set("horario", e.target.value)}
                    className={cn(errors.horario && "border-destructive")} aria-invalid={!!errors.horario} />
                  {errors.horario && <p className="text-sm text-destructive">{errors.horario}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground">Data de subida</Label>
                  <Input
                    value={editing ? new Date(editing.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "Será registrada automaticamente ao salvar"}
                    readOnly disabled className="bg-muted/50 cursor-not-allowed"
                  />
                  <p className="text-[11px] text-muted-foreground">Preenchida automaticamente no momento do cadastro — não editável.</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Vendedor responsável</Label>
                  <Input value={myName || form.vendedor || "—"} readOnly disabled className="bg-muted/50 cursor-not-allowed" />
                  <p className="text-[11px] text-muted-foreground">Identificado automaticamente pelo usuário logado — não editável.</p>
                </div>
              </div>
            </section>

            {/* 2. Local */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Local do evento</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5 sm:col-span-2" data-field="local">
                  <Label>Nome do local *</Label>
                  <TitleCaseInput value={form.local} onValueChange={(v) => set("local", v)} invalid={!!errors.local} />
                  {errors.local && <p className="text-sm text-destructive">{errors.local}</p>}
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
                  <TitleCaseInput value={form.endereco} onValueChange={(v) => set("endereco", v)} />
                </div>
                <div className="space-y-1.5 sm:col-span-2" data-field="cidade">
                  <Label>Cidade *</Label>
                  <TitleCaseInput value={form.cidade} onValueChange={(v) => set("cidade", v)} invalid={!!errors.cidade} />
                  {errors.cidade && <p className="text-sm text-destructive">{errors.cidade}</p>}
                </div>
              </div>
            </section>

            {/* 3. Contratante */}
            <ContratanteSection form={form} setForm={setForm} errors={errors} />

            {/* 4. Cachê */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Cachê e pagamento</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5" data-field="cache_total">
                  <Label>
                    Cachê total *{" "}
                    {cacheMin > 0 && (
                      <span className="text-xs font-normal text-muted-foreground">
                        (mínimo: {fmtBRL(cacheMin)})
                      </span>
                    )}
                  </Label>
                  <CurrencyInput value={form.cache_total} onValueChange={(v) => set("cache_total", v)} invalid={!!errors.cache_total || (cacheBelowMin && !isManager)} />
                  {errors.cache_total && <p className="text-sm text-destructive">{errors.cache_total}</p>}
                  {cacheBelowMin && !isManager && (
                    <p className="text-sm text-destructive">
                      O cachê informado ({fmtBRL(Number(form.cache_total))}) está abaixo do mínimo permitido para este artista ({fmtBRL(cacheMin)}). Somente a gerência pode autorizar valores abaixo do mínimo.
                    </p>
                  )}
                  {cacheBelowMin && isManager && (
                    <div className="rounded-md border border-yellow-500/50 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-900 dark:text-yellow-200">
                      <strong>Atenção:</strong> cachê abaixo do mínimo definido para este artista. Será salvo como exceção pela gerência.
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between rounded-md border px-3 py-2 sm:mt-6">
                  <Label htmlFor="encargos" className="cursor-pointer text-sm">Encargos extras por conta do contratante</Label>
                  <Switch id="encargos" checked={form.encargos_extras} onCheckedChange={(v) => set("encargos_extras", v)} />
                </div>
                <div className="space-y-1.5 sm:col-span-2" data-field="condicao_pagamento">
                  <Label>Condição de pagamento *</Label>
                  <Textarea rows={3} value={form.condicao_pagamento} onChange={(e) => set("condicao_pagamento", e.target.value)}
                    className={cn(errors.condicao_pagamento && "border-destructive")} aria-invalid={!!errors.condicao_pagamento}
                    placeholder="Ex: 50% sinal na assinatura, 50% até 24h antes do show via PIX..." />
                  {errors.condicao_pagamento && <p className="text-sm text-destructive">{errors.condicao_pagamento}</p>}
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Cronograma de Pagamento</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Adicione cada parcela com data prevista e percentual do cachê — o valor é calculado automaticamente. O financeiro usa essas informações para previsibilidade e o saldo a receber é atualizado conforme as baixas.
              </p>
              <PaymentScheduleRows
                items={parcelas}
                onChange={setParcelas}
                cacheTotal={Number(form.cache_total) || 0}
                canEdit={true}
              />
            </section>

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

            {/* 8. Autorização — preenchida automaticamente pelo Diretor ao aprovar */}
            {editing && (editing.autorizado_por_nome || editing.autorizado_por) && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Autorização</h3>
                <p className="text-sm text-muted-foreground">
                  Autorizado por <span className="font-medium text-foreground">{editing.autorizado_por_nome ?? editing.autorizado_por}</span>
                  {editing.autorizado_em && <> em {new Date(editing.autorizado_em).toLocaleString("pt-BR")}</>}
                </p>
              </section>
            )}

            <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              {(!editing || editing.status === "pendente" || editing.status === "aprovada") && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={generateContratanteLink}
                  disabled={generatingLink || saving}
                  title="Salva os dados do show e gera um link para o contratante preencher os dados dele"
                >
                  {generatingLink ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <LinkIcon className="h-4 w-4 mr-2" />}
                  Gerar link para contratante
                </Button>
              )}
              <Button type="submit" disabled={saving || generatingLink}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editing ? "Salvar alterações" : "Cadastrar minuta"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: link gerado para o contratante */}
      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Link gerado para o contratante</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Envie este link ao contratante. Ele poderá preencher os próprios dados sem precisar de login.
            O link expira em <strong>{linkCountdown}</strong>.
          </p>
          {linkData && (
            <div className="rounded-md border p-3 bg-muted/30 text-sm break-all font-mono">
              {buildLink(linkData.token)}
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={copyLink} className="flex-1">
              <Copy className="h-4 w-4 mr-2" /> Copiar link
            </Button>
            <Button onClick={shareWhatsApp} variant="secondary" className="flex-1">
              <MessageCircle className="h-4 w-4 mr-2" /> WhatsApp
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Você também pode preencher os dados manualmente depois — basta cancelar o link na lista de minutas.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {details && (
        <Suspense fallback={null}>
          <ShowDetailsModal
            show={details as any}
            open={!!details}
            onClose={() => setDetails(null)}
            onChanged={load}
          />
        </Suspense>
      )}
    </div>
  );
}

interface ContratanteOpt {
  id: string; nome: string; documento?: string | null; endereco?: string | null;
  cidade?: string | null; estado?: string | null; cep?: string | null;
  telefone?: string | null; email?: string | null;
}

function ContratanteSection({
  form, setForm, errors,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  errors: Record<string, string>;
}) {
  const setF = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const [openCb, setOpenCb] = useState(false);
  const [opts, setOpts] = useState<ContratanteOpt[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const t = setTimeout(async () => {
      const { data } = await supabase.functions.invoke("contratantes-admin", {
        body: { action: "search", q: query },
      });
      setOpts((data?.contratantes ?? []) as ContratanteOpt[]);
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  const selecionar = (c: ContratanteOpt) => {
    setForm((f) => ({
      ...f,
      contratante_id: c.id,
      contratante_nome: c.nome ?? "",
      contratante_documento: c.documento ?? "",
      contratante_endereco: c.endereco ?? "",
      contratante_cidade: c.cidade ?? "",
      contratante_cep: c.cep ?? "",
      contratante_telefone: c.telefone ?? "",
      contratante_email: c.email ?? "",
    }));
    setOpenCb(false);
  };

  const limparVinculo = () => setF("contratante_id", "");

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Contratante</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5 sm:col-span-2" data-field="contratante_nome">
          <Label>Nome / Razão social *</Label>
          <Popover open={openCb} onOpenChange={setOpenCb}>
            <PopoverTrigger asChild>
              <div>
                <Input
                  value={form.contratante_nome}
                  onChange={(e) => {
                    const v = e.target.value;
                    setF("contratante_nome", v);
                    setQuery(v);
                    if (form.contratante_id) setF("contratante_id", "");
                    if (!openCb) setOpenCb(true);
                  }}
                  onFocus={() => setOpenCb(true)}
                  onBlur={(e) => {
                    const next = toTitleCase(e.target.value);
                    if (next !== e.target.value) setF("contratante_nome", next);
                  }}
                  placeholder="Digite para buscar ou cadastrar..."
                  className={cn(errors.contratante_nome && "border-destructive")}
                  aria-invalid={!!errors.contratante_nome}
                />
              </div>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
              <Command shouldFilter={false}>
                <CommandList>
                  <CommandEmpty>Nenhum contratante encontrado. Continue digitando para cadastrar um novo.</CommandEmpty>
                  <CommandGroup heading="Contratantes cadastrados">
                    {opts.map((c) => (
                      <CommandItem key={c.id} value={c.id} onSelect={() => selecionar(c)}>
                        <div className="flex flex-col">
                          <span className="font-medium">{c.nome}</span>
                          {c.documento && <span className="text-xs text-muted-foreground">{formatCpfCnpj(c.documento)}</span>}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {form.contratante_id && (
            <p className="text-[11px] text-muted-foreground">
              Vinculado ao cadastro. <button type="button" className="text-primary underline" onClick={limparVinculo}>desvincular</button>
            </p>
          )}
          {errors.contratante_nome && <p className="text-sm text-destructive">{errors.contratante_nome}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>CNPJ / CPF</Label>
          <Input value={formatCpfCnpj(form.contratante_documento)} onChange={(e) => setF("contratante_documento", e.target.value.replace(/\D/g, ""))} />
        </div>
        <div className="space-y-1.5">
          <Label>CEP</Label>
          <Input value={formatCEP(form.contratante_cep)} onChange={(e) => setF("contratante_cep", e.target.value.replace(/\D/g, ""))} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Endereço</Label>
          <TitleCaseInput value={form.contratante_endereco} onValueChange={(v) => setF("contratante_endereco", v)} />
        </div>
        <div className="space-y-1.5">
          <Label>Cidade</Label>
          <TitleCaseInput value={form.contratante_cidade} onValueChange={(v) => setF("contratante_cidade", v)} />
        </div>
        <div className="space-y-1.5" data-field="contratante_telefone">
          <Label>Telefone *</Label>
          <Input
            value={formatPhoneBR(form.contratante_telefone)}
            onChange={(e) => setF("contratante_telefone", e.target.value.replace(/\D/g, ""))}
            className={cn(errors.contratante_telefone && "border-destructive")}
            aria-invalid={!!errors.contratante_telefone}
          />
          {errors.contratante_telefone && <p className="text-sm text-destructive">{errors.contratante_telefone}</p>}
        </div>
        <div className="space-y-1.5 sm:col-span-2" data-field="contratante_email">
          <Label>E-mail *</Label>
          <Input type="email" value={form.contratante_email} onChange={(e) => setF("contratante_email", e.target.value)}
            className={cn(errors.contratante_email && "border-destructive")} aria-invalid={!!errors.contratante_email} />
          {errors.contratante_email && <p className="text-sm text-destructive">{errors.contratante_email}</p>}
        </div>
        {!form.contratante_id && form.contratante_nome.trim() && form.contratante_documento.trim() && (
          <div className="sm:col-span-2 rounded-md border px-3 py-2 bg-muted/30 text-xs text-muted-foreground">
            Este contratante será cadastrado automaticamente ao salvar a minuta (vinculado pelo CPF/CNPJ).
          </div>
        )}
      </div>
    </section>
  );
}
