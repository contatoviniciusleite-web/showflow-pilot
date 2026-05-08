import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, FileSignature, Send, Save, Download, RefreshCw, Ban } from "lucide-react";
import { toast } from "sonner";
import * as Sentry from "@sentry/react";

type ShowForContract = {
  id: string;
  artist_nome?: string | null;
  data_show: string;
  horario?: string | null;
  local?: string | null;
  cidade?: string | null;
  cache_total?: number;
  contratante_nome?: string | null;
  contratante_documento?: string | null;
  condicao_pagamento?: string | null;
  created_by?: string | null;
};

type Template = { id: string; name: string; content: string };

type Contract = {
  id: string;
  status: string;
  content_snapshot: string;
  sent_at: string | null;
  signed_at: string | null;
  created_at: string;
  updated_at: string;
  docusign_envelope_id: string | null;
};

type StatusEvent = { status: string; at: string };

const STATUS_META: Record<string, { label: string; cls: string }> = {
  draft: { label: "Rascunho", cls: "bg-muted text-foreground" },
  sent: { label: "Aguardando assinatura", cls: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300" },
  partially_signed: { label: "Parcialmente assinado", cls: "bg-orange-500/20 text-orange-700 dark:text-orange-300" },
  signed: { label: "Assinado", cls: "bg-green-600/20 text-green-700 dark:text-green-300" },
  expired: { label: "Expirado", cls: "bg-red-600/20 text-red-700 dark:text-red-300" },
  cancelled: { label: "Cancelado", cls: "bg-black text-white" },
};

function fmtBRL(n: number) {
  return Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtCNPJ(doc: string | null | undefined) {
  if (!doc) return "";
  const d = doc.replace(/\D/g, "");
  if (d.length === 14) {
    return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  }
  if (d.length === 11) {
    return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  }
  return doc;
}

function fmtDataExtenso(iso: string) {
  return format(new Date(iso + (iso.includes("T") ? "" : "T00:00:00")), "d 'de' MMMM 'de' yyyy", { locale: ptBR });
}

const VAR_KEYS = [
  "nome_artista", "data_show", "horario_show", "local_show", "cidade_show",
  "valor_cache", "forma_pagamento", "valor_entrada", "valor_saldo",
  "nome_contratante", "cnpj_contratante", "nome_produtora", "cnpj_produtora",
  "data_geracao",
] as const;

export function ContractTab({ show, onChanged }: { show: ShowForContract; onChanged?: () => void }) {
  const { user, roles } = useAuth();
  const isDiretor = roles.includes("diretor");
  const isFinanceiro = roles.includes("financeiro");
  const canManage = isDiretor || isFinanceiro;

  const [loading, setLoading] = useState(true);
  const [contract, setContract] = useState<Contract | null>(null);
  const [history, setHistory] = useState<StatusEvent[]>([]);
  const [openModal, setOpenModal] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("contracts")
      .select("id, status, content_snapshot, sent_at, signed_at, created_at, updated_at, docusign_envelope_id")
      .eq("show_id", show.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) toast.error(error.message);
    setContract((data as Contract) ?? null);
    if (data) {
      const evs: StatusEvent[] = [{ status: "draft", at: data.created_at }];
      if (data.sent_at) evs.push({ status: "sent", at: data.sent_at });
      if (data.signed_at) evs.push({ status: "signed", at: data.signed_at });
      if (["expired", "cancelled", "partially_signed"].includes(data.status) &&
          !evs.find((e) => e.status === data.status)) {
        evs.push({ status: data.status, at: data.updated_at });
      }
      setHistory(evs);
    } else {
      setHistory([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [show.id]);

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  const handleDownloadSigned = async () => {
    if (!contract) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("docusign-integration", {
        body: { action: "download_signed", contract_id: contract.id },
      });
      if (error) throw error;
      const url = (data as any)?.url ?? (data as any)?.signed_pdf_url;
      if (url) window.open(url, "_blank");
      else toast.success("PDF gerado");
    } catch (err: any) {
      Sentry.captureException(err);
      toast.error(err.message ?? "Falha ao baixar PDF");
    } finally { setBusy(false); }
  };

  const handleResend = async () => {
    if (!contract) return;
    setBusy(true);
    try {
      const { error } = await supabase.functions.invoke("docusign-integration", {
        body: { action: "send_envelope", contract_id: contract.id },
      });
      if (error) throw error;
      toast.success("Contrato reenviado");
      load(); onChanged?.();
    } catch (err: any) {
      Sentry.captureException(err);
      toast.error(err.message ?? "Falha ao reenviar");
    } finally { setBusy(false); }
  };

  const handleCancel = async () => {
    if (!contract) return;
    if (!confirm("Cancelar este contrato?")) return;
    setBusy(true);
    const { error } = await supabase
      .from("contracts")
      .update({ status: "cancelled" })
      .eq("id", contract.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Contrato cancelado");
    load(); onChanged?.();
  };

  if (!contract) {
    return (
      <div className="space-y-4">
        <Card className="p-8 text-center">
          <FileSignature className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground mb-4">Nenhum contrato gerado para este show</p>
          {canManage && (
            <Button onClick={() => setOpenModal(true)}>
              <FileSignature className="h-4 w-4 mr-2" />Gerar contrato
            </Button>
          )}
        </Card>

        {openModal && (
          <GenerateContractModal
            show={show}
            open={openModal}
            onOpenChange={setOpenModal}
            userId={user?.id ?? ""}
            onCreated={() => { load(); onChanged?.(); }}
          />
        )}
      </div>
    );
  }

  const meta = STATUS_META[contract.status] ?? { label: contract.status, cls: "bg-muted" };

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={meta.cls}>{meta.label}</Badge>
            {contract.sent_at && (
              <span className="text-xs text-muted-foreground">
                Enviado em {format(new Date(contract.sent_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </span>
            )}
            {contract.signed_at && (
              <span className="text-xs text-muted-foreground">
                · Assinado em {format(new Date(contract.signed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {contract.status === "signed" && (
              <Button size="sm" variant="outline" onClick={handleDownloadSigned} disabled={busy}>
                <Download className="h-4 w-4 mr-1.5" />Baixar PDF assinado
              </Button>
            )}
            {contract.status === "expired" && canManage && (
              <Button size="sm" variant="outline" onClick={handleResend} disabled={busy}>
                <RefreshCw className="h-4 w-4 mr-1.5" />Reenviar
              </Button>
            )}
            {(contract.status === "draft" || contract.status === "sent") && canManage && (
              <Button size="sm" variant="destructive" onClick={handleCancel} disabled={busy}>
                <Ban className="h-4 w-4 mr-1.5" />Cancelar contrato
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Histórico</p>
        <div className="space-y-1 text-sm">
          {history.map((h, i) => {
            const m = STATUS_META[h.status] ?? { label: h.status, cls: "bg-muted" };
            return (
              <div key={i} className="flex items-center gap-2">
                <Badge className={m.cls + " text-xs"}>{m.label}</Badge>
                <span className="text-muted-foreground text-xs">
                  {format(new Date(h.at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

/* -------- Modal de geração -------- */

function GenerateContractModal({
  show, open, onOpenChange, userId, onCreated,
}: {
  show: ShowForContract;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
  onCreated: () => void;
}) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState<string>("");
  const [content, setContent] = useState("");
  const [vars, setVars] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [tpls, settings, schedule] = await Promise.all([
        supabase.from("contract_templates").select("id, name, content").eq("is_active", true).order("name"),
        supabase.from("app_settings").select("key, value").in("key", ["nome_produtora", "cnpj_produtora"]),
        supabase.from("show_payment_schedule").select("descricao, valor, ordem").eq("show_id", show.id).order("ordem"),
      ]);

      if (tpls.error) toast.error(tpls.error.message);
      setTemplates((tpls.data ?? []) as Template[]);

      const settingsMap: Record<string, string> = {};
      (settings.data ?? []).forEach((s: any) => {
        const v = typeof s.value === "string" ? s.value : (s.value?.valor ?? s.value?.value ?? "");
        settingsMap[s.key] = String(v ?? "");
      });

      const parcelas = (schedule.data ?? []) as Array<{ descricao: string | null; valor: number; ordem: number }>;
      const total = Number(show.cache_total ?? 0);
      let entrada = 0;
      let saldo = 0;
      if (parcelas.length >= 2) {
        entrada = Number(parcelas[0]?.valor ?? 0);
        saldo = parcelas.slice(1).reduce((s, p) => s + Number(p.valor ?? 0), 0);
      } else if (parcelas.length === 1) {
        entrada = Number(parcelas[0]?.valor ?? 0);
        saldo = Math.max(total - entrada, 0);
      } else {
        saldo = total;
      }

      setVars({
        nome_artista: show.artist_nome ?? "",
        data_show: show.data_show ? fmtDataExtenso(show.data_show) : "",
        horario_show: show.horario ? show.horario.slice(0, 5) : "",
        local_show: show.local ?? "",
        cidade_show: show.cidade ?? "",
        valor_cache: total ? fmtBRL(total) : "",
        forma_pagamento: show.condicao_pagamento ?? "",
        valor_entrada: entrada ? fmtBRL(entrada) : "",
        valor_saldo: saldo ? fmtBRL(saldo) : "",
        nome_contratante: show.contratante_nome ?? "",
        cnpj_contratante: fmtCNPJ(show.contratante_documento),
        nome_produtora: settingsMap["nome_produtora"] ?? "",
        cnpj_produtora: fmtCNPJ(settingsMap["cnpj_produtora"]) || (settingsMap["cnpj_produtora"] ?? ""),
        data_geracao: fmtDataExtenso(new Date().toISOString().slice(0, 10)),
      });
      setLoading(false);
    })();
  }, [show.id]);

  // Aplicar template ao selecionar
  useEffect(() => {
    if (!templateId) return;
    const t = templates.find((x) => x.id === templateId);
    if (!t) return;
    let body = t.content;
    VAR_KEYS.forEach((k) => {
      const value = vars[k] ?? "";
      const re = new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, "g");
      body = body.replace(re, value || `{{${k}}}`);
    });
    setContent(body);
  }, [templateId, templates, vars]);

  const missingVars = useMemo(() => {
    const found = new Set<string>();
    const re = /\{\{\s*([a-z_]+)\s*\}\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) found.add(m[1]);
    return Array.from(found);
  }, [content]);

  // Highlight para preview
  const highlighted = useMemo(() => {
    return content.replace(
      /\{\{\s*[a-z_]+\s*\}\}/g,
      (s) => `<<MISSING>>${s}<<END>>`
    );
  }, [content]);

  const save = async (alsoSend: boolean) => {
    if (!templateId) return toast.error("Selecione um template");
    if (!content.trim()) return toast.error("Conteúdo vazio");
    setBusy(true);
    try {
      const insert = await supabase
        .from("contracts")
        .insert({
          show_id: show.id,
          template_id: templateId,
          content_snapshot: content,
          status: alsoSend ? "sent" : "draft",
          sold_by: show.created_by ?? userId,
          created_by: userId,
          sent_at: alsoSend ? new Date().toISOString() : null,
        })
        .select("id")
        .single();
      if (insert.error) throw insert.error;

      if (alsoSend && insert.data?.id) {
        const { error: fnErr } = await supabase.functions.invoke("docusign-integration", {
          body: { action: "send_envelope", contract_id: insert.data.id },
        });
        if (fnErr) throw fnErr;
      }
      toast.success(alsoSend ? "Contrato enviado para assinatura" : "Rascunho salvo");
      onOpenChange(false);
      onCreated();
    } catch (err: any) {
      Sentry.captureException(err);
      toast.error(err.message ?? "Falha ao salvar contrato");
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerar contrato</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Template</Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder={templates.length ? "Selecione um template" : "Nenhum template ativo cadastrado"} />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {templateId && (
              <>
                <div className="space-y-1.5">
                  <Label>Preview (variáveis em vermelho não foram preenchidas)</Label>
                  <Card
                    className="p-4 bg-muted/30 max-h-[280px] overflow-y-auto whitespace-pre-wrap text-xs font-mono"
                    dangerouslySetInnerHTML={{
                      __html: escapeHtml(highlighted)
                        .replace(/&lt;&lt;MISSING&gt;&gt;/g, '<span class="bg-red-500/20 text-red-700 dark:text-red-300 px-1 rounded">')
                        .replace(/&lt;&lt;END&gt;&gt;/g, "</span>"),
                    }}
                  />
                  {missingVars.length > 0 && (
                    <p className="text-xs text-red-600 dark:text-red-400">
                      Variáveis sem dados: {missingVars.map((v) => `{{${v}}}`).join(", ")}. Edite manualmente abaixo.
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label>Conteúdo final (editável)</Label>
                  <Textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="font-mono text-xs min-h-[280px]"
                  />
                </div>
              </>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</Button>
          <Button variant="outline" onClick={() => save(false)} disabled={busy || !templateId}>
            <Save className="h-4 w-4 mr-1.5" />Salvar rascunho
          </Button>
          <Button onClick={() => save(true)} disabled={busy || !templateId}>
            <Send className="h-4 w-4 mr-1.5" />Enviar para assinatura
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
