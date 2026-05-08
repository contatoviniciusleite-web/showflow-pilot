import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trash2, CheckCircle2, Paperclip, Eye, Upload, Loader2, X } from "lucide-react";
import * as Sentry from "@sentry/react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { canRegisterPayment, canDeletePayment, canViewConfirmedBy } from "@/lib/permissions";
import { formatCurrencyBRL } from "@/lib/masks";
import { ExportMenu } from "@/components/ExportMenu";
import type { Column } from "@/lib/exporters";
import { Skeleton } from "@/components/ui/skeleton";

interface Payment {
  id: string;
  show_id: string;
  valor: number | string;
  data_pagamento: string;
  forma_pagamento: string;
  conta_destino: string | null;
  observacoes: string | null;
  attachment_id: string | null;
  attachment_file_name?: string | null;
  attachment_mime_type?: string | null;
  registrado_por_nome: string | null;
  created_at: string;
}

interface Attachment {
  id: string;
  file_name: string;
  mime_type: string | null;
  created_at: string;
}

interface Props {
  showId: string;
  status: string;
  confirmadoPorNome?: string | null;
  confirmadoEm?: string | null;
  onChanged?: () => void;
  artistNome?: string | null;
  showDate?: string | null;
  showLocal?: string | null;
}

const FORMA_LABEL: Record<string, string> = {
  pix: "PIX", transferencia: "Transferência", especie: "Espécie", outro: "Outro",
};

const toN = (v: any) => Number(v ?? 0);

const safeFmt = (value: string | null | undefined, pattern: string, opts?: any) => {
  if (!value) return "—";
  try {
    const d = value.length === 10 ? new Date(value + "T00:00:00") : new Date(value);
    if (isNaN(d.getTime())) return "—";
    return format(d, pattern, opts);
  } catch {
    return "—";
  }
};

export function PaymentsTab({ showId, status: statusProp, confirmadoPorNome, confirmadoEm, onChanged, artistNome, showDate, showLocal }: Props) {
  const { roles } = useAuth();
  const [items, setItems] = useState<Payment[]>([]);
  const [cacheTotal, setCacheTotal] = useState(0);
  const [totalPago, setTotalPago] = useState(0);
  const [status, setStatus] = useState(statusProp);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // form
  const [valor, setValor] = useState(0);
  const [data, setData] = useState(format(new Date(), "yyyy-MM-dd"));
  const [forma, setForma] = useState("pix");
  const [conta, setConta] = useState("");
  const [obs, setObs] = useState("");
  const [attachmentId, setAttachmentId] = useState<string | null>(null);
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [existing, setExisting] = useState<Attachment[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const saldo = useMemo(() => Math.max(0, cacheTotal - totalPago), [cacheTotal, totalPago]);
  const quitado = cacheTotal > 0 && saldo <= 0.005;

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("shows-admin", {
        body: { action: "list_payments", show_id: showId },
      });
      if (error) throw error;
      setItems(Array.isArray(data?.payments) ? (data.payments as Payment[]) : []);
      setCacheTotal(toN(data?.cache_total));
      setTotalPago(toN(data?.total_pago));
      if (data?.status) setStatus(data.status);
    } catch (err: any) {
      console.error("Erro ao carregar pagamentos:", err);
      toast.error(err?.message ?? "Não foi possível carregar os pagamentos.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [showId]);

  // Prefill com saldo em aberto
  useEffect(() => {
    if (!loading) setValor(saldo);
    // eslint-disable-next-line
  }, [saldo, loading]);

  const [loadingExisting, setLoadingExisting] = useState(false);

  const openExistingPicker = async () => {
    setPickerOpen(true);
    setLoadingExisting(true);
    try {
      const { data, error } = await supabase.functions.invoke("shows-admin", {
        body: { action: "list_attachments", show_id: showId },
      });
      if (error) throw error;
      setExisting(Array.isArray(data?.attachments) ? (data.attachments as Attachment[]) : []);
    } catch (err: any) {
      console.error("Erro ao carregar anexos:", err);
      toast.error(err?.message ?? "Não foi possível carregar os anexos.");
      setExisting([]);
      setPickerOpen(false);
    } finally {
      setLoadingExisting(false);
    }
  };

  const pickExisting = (a: Attachment) => {
    setAttachmentId(a.id);
    setAttachmentName(a.file_name);
    setPickerOpen(false);
  };

  const handleNewUpload = () => fileRef.current?.click();

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const allowed = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];
    if (!allowed.includes(file.type)) return toast.error("Use PDF, JPG, JPEG ou PNG.");
    if (file.size > 10 * 1024 * 1024) return toast.error("Arquivo excede 10MB.");
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() ?? "bin").toLowerCase();
      const slug = (artistNome ?? "anexo").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const path = `${showId}/${slug}-${showDate ?? "data"}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("comprovantes").upload(path, file, {
        contentType: file.type, upsert: false,
      });
      if (upErr) throw upErr;
      const { data, error } = await supabase.functions.invoke("shows-admin", {
        body: {
          action: "add_attachment", show_id: showId, path,
          file_name: file.name, mime_type: file.type, size_bytes: file.size, tipo: "comprovante",
        },
      });
      if (error) throw error;
      const att = data?.attachment;
      if (att?.id) {
        setAttachmentId(att.id);
        setAttachmentName(att.file_name);
        toast.success("Comprovante anexado");
      }
    } catch (e: any) {
      Sentry.captureException(e, {
        tags: { action: "upload_comprovante", show_id: showId },
        extra: { file_name: file.name, size: file.size },
      });
      toast.error(e?.message ?? "Falha ao enviar");
    } finally {
      setUploading(false);
    }
  };

  const viewAttachment = async (id: string) => {
    const { data, error } = await supabase.functions.invoke("shows-admin", {
      body: { action: "attachment_signed_url", id },
    });
    if (error) return toast.error(error.message);
    if (data?.url) window.open(data.url, "_blank");
  };

  const submit = async () => {
    if (valor <= 0) return toast.error("Informe o valor");
    if (valor > saldo + 0.005) {
      return toast.error(`O valor informado é maior que o saldo em aberto (${formatCurrencyBRL(saldo)}).`);
    }
    if (!data) return toast.error("Informe a data");
    if (!attachmentId && !obs.trim()) return toast.error("Anexe um comprovante ou preencha as observações.");
    setSaving(true);
    const { data: resp, error } = await supabase.functions.invoke("shows-admin", {
      body: {
        action: "register_payment",
        show_id: showId,
        valor, data_pagamento: data, forma_pagamento: forma,
        conta_destino: conta, observacoes: obs,
        attachment_id: attachmentId,
      },
    });
    setSaving(false);
    if (error) {
      Sentry.captureException(error, {
        tags: { action: "register_payment", show_id: showId },
        extra: { valor, data_pagamento: data, forma_pagamento: forma },
      });
      return toast.error(error.message);
    }
    const novoSaldo = Number(resp?.saldo_aberto ?? 0);
    if (resp?.quitado) {
      toast.success("✅ Pagamento quitado! Show confirmado.");
    } else if (resp?.confirmado) {
      toast.success(`✅ Sinal confirmado! Show confirmado. Saldo restante: ${formatCurrencyBRL(novoSaldo)}`);
    } else {
      toast.success(`Baixa registrada. Saldo restante: ${formatCurrencyBRL(novoSaldo)}`);
    }
    setObs(""); setConta(""); setAttachmentId(null); setAttachmentName(null);
    await load();
    onChanged?.();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir esta baixa? Se isto reabrir o saldo, o show voltará para 'Aguardando pagamento'.")) return;
    const { data, error } = await supabase.functions.invoke("shows-admin", { body: { action: "delete_payment", id } });
    if (error) return toast.error(error.message);
    if (data?.reaberto) toast.success("Baixa excluída — show voltou para Aguardando pagamento");
    else toast.success("Baixa excluída");
    load(); onChanged?.();
  };

  const canRegister = canRegisterPayment(roles);
  const canDelete = canDeletePayment(roles);
  const canExport = roles.includes("financeiro") || roles.includes("gerente") || roles.includes("diretor");
  const showConfirmedBy = canViewConfirmedBy(roles) && status === "confirmado" && confirmadoPorNome;

  const exportExtrato = (kind: "pdf" | "csv") => {
    const cols: Column[] = [
      { header: "Data", key: (r: Payment) => safeFmt(r.data_pagamento, "dd/MM/yyyy") },
      { header: "Valor", key: (r: Payment) => formatCurrencyBRL(toN(r.valor)), align: "right" },
      { header: "Forma", key: (r: Payment) => FORMA_LABEL[r.forma_pagamento] ?? r.forma_pagamento },
      { header: "Conta", key: (r: Payment) => r.conta_destino ?? "—" },
      { header: "Observações", key: (r: Payment) => r.observacoes ?? "" },
      { header: "Confirmado por", key: (r: Payment) => r.registrado_por_nome ?? "—" },
      { header: "Registrado em", key: (r: Payment) => safeFmt(r.created_at, "dd/MM/yyyy HH:mm") },
      { header: "Comprovante", key: (r: Payment) => r.attachment_file_name ?? "—" },
    ];
    const meta = {
      title: `Extrato de baixas — ${artistNome ?? "Show"}`,
      subtitle: `${showLocal ?? ""}${showDate ? ` · ${safeFmt(showDate, "dd/MM/yyyy")}` : ""}`,
      filters: [
        `Cachê total: ${formatCurrencyBRL(cacheTotal)}`,
        `Total pago: ${formatCurrencyBRL(totalPago)}`,
        `Saldo: ${formatCurrencyBRL(saldo)}`,
        `Status: ${quitado ? "Pagamento quitado" : status}`,
      ],
      summary: [
        { label: "Total de baixas", value: String(items.length) },
        { label: "Total pago", value: formatCurrencyBRL(totalPago) },
        { label: "Saldo em aberto", value: formatCurrencyBRL(saldo) },
      ],
      filename: `extrato-${(artistNome ?? "show").toLowerCase().replace(/\s+/g, "-")}-${showDate ?? ""}`,
    };
    if (kind === "pdf") exportPDF(items, cols, meta);
    else exportCSV(items, cols, meta);
  };

  return (
    <div className="space-y-4">
      {showConfirmedBy && (
        <div className="rounded-md bg-green-500/10 border border-green-500/30 p-3 text-sm">
          ✓ Confirmado por <strong>{confirmadoPorNome}</strong>
          {confirmadoEm && <> em {safeFmt(confirmadoEm, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</>}
        </div>
      )}

      {/* Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Cachê total</p>
          <p className="font-semibold">{formatCurrencyBRL(cacheTotal)}</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground">Total confirmado</p>
          <p className="font-semibold">{formatCurrencyBRL(totalPago)}</p>
        </div>
        <div className={`rounded-md border p-3 ${quitado ? "bg-green-500/10 border-green-500/30" : "bg-amber-500/10 border-amber-500/30"}`}>
          <p className="text-xs text-muted-foreground">{quitado ? "Status" : "Em aberto"}</p>
          <p className="font-semibold">{quitado ? "Pagamento quitado" : formatCurrencyBRL(saldo)}</p>
        </div>
      </div>

      {/* Painel de baixa */}
      {canRegister && (
        <div className="rounded-md border p-4 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <h3 className="font-medium">Registrar baixa de pagamento</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Valor da baixa *</Label>
              <CurrencyInput value={valor} onValueChange={setValor} disabled={quitado} />
            </div>
            <div>
              <Label>Data do pagamento *</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} disabled={quitado} />
            </div>
            <div>
              <Label>Forma de pagamento</Label>
              <Select value={forma} onValueChange={setForma} disabled={quitado}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="transferencia">Transferência</SelectItem>
                  <SelectItem value="especie">Espécie</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Conta de destino</Label>
              <Input value={conta} onChange={(e) => setConta(e.target.value)} placeholder="Ex.: Banco do Brasil ag 1234" disabled={quitado} />
            </div>
            <div className="sm:col-span-2">
              <Label>Comprovante (opcional se houver observações)</Label>
              <input ref={fileRef} type="file" accept="application/pdf,image/png,image/jpeg,image/jpg" className="hidden" onChange={onFileChange} />
              {attachmentId ? (
                <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Paperclip className="h-4 w-4 shrink-0" />
                    <span className="text-sm truncate">{attachmentName}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="icon" variant="ghost" onClick={() => viewAttachment(attachmentId)} title="Ver"><Eye className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { setAttachmentId(null); setAttachmentName(null); }} title="Remover">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={openExistingPicker} disabled={quitado}>
                    <Paperclip className="h-4 w-4 mr-1" /> Vincular existente
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={handleNewUpload} disabled={quitado || uploading}>
                    {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                    Anexar novo
                  </Button>
                </div>
              )}
            </div>
            <div className="sm:col-span-2">
              <Label>Observações {!attachmentId && "*"}</Label>
              <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2}
                placeholder={attachmentId ? "Opcional quando há comprovante" : "Obrigatório quando não há comprovante"} disabled={quitado} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={submit} disabled={saving || quitado || valor <= 0}>
              {quitado ? "Pagamento quitado" : saving ? "Salvando…" : "Registrar Baixa"}
            </Button>
          </div>
        </div>
      )}

      {/* Histórico */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium">Histórico de baixas</h3>
          {canExport && items.length > 0 && (
            <ExportMenu
              label="Exportar extrato"
              onExportPDF={() => exportExtrato("pdf")}
              onExportCSV={() => exportExtrato("csv")}
            />
          )}
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : items.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nenhuma baixa registrada.
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((p) => (
              <li key={p.id} className="border rounded-md p-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">
                    {formatCurrencyBRL(toN(p.valor))}
                    <span className="text-muted-foreground font-normal"> · {FORMA_LABEL[p.forma_pagamento] ?? p.forma_pagamento}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Pago em {safeFmt(p.data_pagamento, "dd/MM/yyyy", { locale: ptBR })}
                    {p.conta_destino ? ` · ${p.conta_destino}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Confirmado por {p.registrado_por_nome ?? "—"} em {safeFmt(p.created_at, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                  {p.observacoes && <p className="text-xs mt-1">{p.observacoes}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {p.attachment_id && (
                    <Button size="sm" variant="outline" onClick={() => viewAttachment(p.attachment_id!)} title="Ver comprovante">
                      <Eye className="h-4 w-4 mr-1" /> Ver comprovante
                    </Button>
                  )}
                  {canDelete && (
                    <Button size="icon" variant="ghost" onClick={() => remove(p.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Modal seletor de comprovante existente */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Selecionar comprovante</DialogTitle></DialogHeader>
          {loadingExisting ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (existing ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhum comprovante encontrado para este show. Use a aba Anexos para fazer o upload primeiro.
            </p>
          ) : (
            <ul className="space-y-2 max-h-[60vh] overflow-y-auto">
              {existing.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 border rounded-md p-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{a.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {safeFmt(a.created_at, "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="icon" variant="ghost" onClick={() => viewAttachment(a.id)} title="Ver"><Eye className="h-4 w-4" /></Button>
                    <Button size="sm" onClick={() => pickExisting(a)}>Vincular</Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
