import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { STATUS_CLASS, STATUS_LABEL } from "@/lib/showStatus";
import { AttachmentsTab } from "./AttachmentsTab";
import { StatusHistoryTab } from "./StatusHistoryTab";
import { PaymentsTab } from "./PaymentsTab";
import { PaymentScheduleEditor } from "./PaymentScheduleEditor";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import * as Sentry from "@sentry/react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, FileDown } from "lucide-react";
import { exportDocumentPDF } from "@/lib/exporters";
import { ErrorBoundary } from "@/components/ErrorBoundary";

interface ShowLite {
  id: string;
  artist_nome?: string | null;
  artist_cache_minimo?: number | null;
  data_show: string;
  horario?: string | null;
  local?: string | null;
  cidade?: string | null;
  endereco?: string | null;
  capacidade?: number | null;
  cache_total?: number;
  status: string;
  vendedor?: string | null;
  contratante_nome?: string | null;
  contratante_documento?: string | null;
  contratante_telefone?: string | null;
  contratante_email?: string | null;
  contratante_endereco?: string | null;
  contratante_cidade?: string | null;
  contratante_cep?: string | null;
  condicao_pagamento?: string | null;
  camarins_rider?: string | null;
  transp_observacoes?: string | null;
  transp_aereo?: boolean | null;
  transp_van?: boolean | null;
  transp_onibus?: boolean | null;
  transp_excesso_bagagem?: boolean | null;
  hosp_traslado?: boolean | null;
  hosp_hospedagem?: boolean | null;
  hosp_diaria_alimentacao?: boolean | null;
  encargos_extras?: boolean | null;
  created_by?: string | null;
  confirmado_por_nome?: string | null;
  confirmado_em?: string | null;
  autorizado_por_nome?: string | null;
  autorizado_em?: string | null;
  autorizado_por?: string | null;
  confirmado_sem_pagamento?: boolean | null;
  confirmado_sem_pagamento_motivo?: string | null;
}

interface Props {
  show: ShowLite | null;
  open: boolean;
  onClose: () => void;
  onChanged?: () => void;
}

function fmtBRL(n: number) {
  return Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function ShowDetailsModal({ show, open, onClose, onChanged }: Props) {
  const { roles, user } = useAuth();
  const [tab, setTab] = useState("geral");
  const [busy, setBusy] = useState(false);
  const [rejectMotivo, setRejectMotivo] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [reschedDate, setReschedDate] = useState("");
  const [reschedTime, setReschedTime] = useState("");
  const [reschedMotivo, setReschedMotivo] = useState("");
  const [showResched, setShowResched] = useState(false);
  const [showConfirmNoPay, setShowConfirmNoPay] = useState(false);
  const [confirmNoPayMotivo, setConfirmNoPayMotivo] = useState("");

  if (!show) return null;
  const isArtista = roles.includes("artista") && roles.length === 1;
  const isManager = roles.includes("gerente");
  const isDiretor = roles.includes("diretor");
  const isFinanceiro = roles.includes("financeiro");
  const isOwner = show.created_by && user?.id === show.created_by;
  const canUpload =
    roles.includes("gerente") || roles.includes("equipe") || roles.includes("financeiro") || roles.includes("diretor") ||
    (roles.includes("vendedor") && isOwner);
  const canManageActions = isManager || isDiretor; // remarcar/cancelar
  const canDeleteShow = isFinanceiro; // excluir minuta
  const canApproveOrReject = isDiretor; // só diretor aprova/rejeita
  const canSeeAutorizado = isDiretor || isManager || isFinanceiro;

  const cacheMin = Number(show.artist_cache_minimo ?? 0);
  const cacheTotal = Number(show.cache_total ?? 0);
  const isExcecaoCache = cacheMin > 0 && cacheTotal > 0 && cacheTotal < cacheMin;
  const canSeeExcecao = isManager || isFinanceiro || isDiretor;

  const callAction = async (action: string, extra: Record<string, unknown> = {}) => {
    setBusy(true);
    try {
      const { error } = await supabase.functions.invoke("shows-admin", {
        body: { action, id: show.id, ...extra },
      });
      if (error) throw error;
      toast.success("Ação realizada");
      onChanged?.();
      onClose();
    } catch (err: any) {
      Sentry.captureException(err, {
        tags: { action, show_id: show.id },
        extra,
      });
      toast.error(err.message ?? "Falha na ação");
    } finally {
      setBusy(false);
    }
  };

  const approve = () => callAction("approve");
  const deleteMinuta = async () => {
    if (!confirm("Excluir esta minuta permanentemente? Esta ação não pode ser desfeita.")) return;
    await callAction("delete");
  };
  const cancel = async () => {
    if (!confirm("Confirmar cancelamento deste show?")) return;
    await callAction("cancel", { motivo: "Cancelado pela gerência" });
  };
  const reject = async () => {
    if (!rejectMotivo.trim()) return toast.error("Informe o motivo da rejeição");
    await callAction("reject", { motivo: rejectMotivo });
  };
  const reschedule = async () => {
    if (!reschedDate || !reschedMotivo.trim()) return toast.error("Informe nova data e motivo");
    await callAction("reschedule", { data_nova: reschedDate, horario_novo: reschedTime || null, motivo: reschedMotivo });
  };
  const confirmWithoutPayment = async () => {
    if (!confirmNoPayMotivo.trim()) return toast.error("Informe o motivo");
    await callAction("confirm_without_payment", { motivo: confirmNoPayMotivo });
  };

  const canConfirmWithoutPayment = (isDiretor || isFinanceiro) &&
    (show.status === "aprovada" || show.status === "aguardando_pagamento");

  const exportMinuta = () => {
    const transp: string[] = [];
    if (show.transp_aereo) transp.push("Aéreo");
    if (show.transp_van) transp.push("Van");
    if (show.transp_onibus) transp.push("Ônibus");
    if (show.transp_excesso_bagagem) transp.push("Excesso de bagagem");
    const hosp: string[] = [];
    if (show.hosp_traslado) hosp.push("Traslado");
    if (show.hosp_hospedagem) hosp.push("Hospedagem");
    if (show.hosp_diaria_alimentacao) hosp.push("Diária de alimentação");

    exportDocumentPDF({
      title: `Minuta — ${show.artist_nome ?? "Show"}`,
      subtitle: `${format(new Date(show.data_show + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })}${show.horario ? ` às ${show.horario.slice(0, 5)}` : ""}`,
      filename: `minuta-${show.artist_nome?.replace(/\s+/g, "_") ?? "show"}-${show.data_show}`,
      footer: `Status: ${(STATUS_LABEL as any)[show.status] ?? show.status}`,
      sections: [
        {
          title: "Evento",
          lines: [
            { label: "Artista", value: show.artist_nome ?? "—" },
            { label: "Data", value: format(new Date(show.data_show + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR }) },
            { label: "Horário", value: show.horario ? show.horario.slice(0, 5) : "—" },
            { label: "Local", value: show.local ?? "—" },
            { label: "Endereço", value: show.endereco ?? "—" },
            { label: "Cidade", value: show.cidade ?? "—" },
            { label: "Capacidade", value: show.capacidade ? String(show.capacidade) : "—" },
          ],
        },
        {
          title: "Contratante",
          lines: [
            { label: "Nome / Razão Social", value: show.contratante_nome ?? "—" },
            { label: "Documento", value: show.contratante_documento ?? "—" },
            { label: "Telefone", value: show.contratante_telefone ?? "—" },
            { label: "E-mail", value: show.contratante_email ?? "—" },
            { label: "Endereço", value: show.contratante_endereco ?? "—" },
            { label: "Cidade", value: show.contratante_cidade ?? "—" },
            { label: "CEP", value: show.contratante_cep ?? "—" },
          ],
        },
        {
          title: "Financeiro",
          lines: [
            { label: "Cachê total", value: fmtBRL(cacheTotal) },
            { label: "Condição de pagamento", value: show.condicao_pagamento ?? "—" },
            { label: "Encargos extras", value: show.encargos_extras ? "Sim" : "Não" },
          ],
        },
        {
          title: "Produção",
          lines: [
            { label: "Transporte", value: transp.length ? transp.join(", ") : "—" },
            { label: "Observações de transporte", value: show.transp_observacoes ?? "—" },
            { label: "Hospedagem", value: hosp.length ? hosp.join(", ") : "—" },
            { label: "Camarins / Rider", value: show.camarins_rider ?? "—" },
          ],
        },
        {
          title: "Comercial",
          lines: [
            { label: "Vendedor", value: show.vendedor ?? "—" },
            { label: "Autorizado por", value: show.autorizado_por_nome ?? show.autorizado_por ?? "—" },
            {
              label: "Autorizado em",
              value: show.autorizado_em ? format(new Date(show.autorizado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : "—",
            },
          ],
        },
      ],
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            {show.artist_nome ?? "Show"}
            <Badge className={(STATUS_CLASS as any)[show.status]}>{(STATUS_LABEL as any)[show.status] ?? show.status}</Badge>
            <Button size="sm" variant="outline" className="ml-auto gap-1.5" onClick={exportMinuta}>
              <FileDown className="h-3.5 w-3.5" /> Minuta PDF
            </Button>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="geral">Geral</TabsTrigger>
            {!isArtista && <TabsTrigger value="cronograma">Cronograma</TabsTrigger>}
            {!isArtista && <TabsTrigger value="financeiro">Financeiro</TabsTrigger>}
            {!isArtista && <TabsTrigger value="anexos">Anexos</TabsTrigger>}
            {(isManager || isDiretor || isFinanceiro) && <TabsTrigger value="historico">Histórico</TabsTrigger>}
          </TabsList>

          <TabsContent value="geral" className="space-y-3 text-sm">
            <p><strong>Data:</strong> {format(new Date(show.data_show + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })}{show.horario ? ` às ${show.horario.slice(0,5)}` : ""}</p>
            {show.local && <p><strong>Local:</strong> {show.local}{show.cidade ? ` · ${show.cidade}` : ""}</p>}
            {show.contratante_nome && <p><strong>Contratante:</strong> {show.contratante_nome}</p>}
            {show.vendedor && <p><strong>Vendedor:</strong> {show.vendedor}</p>}
            {typeof show.cache_total === "number" && (
              <p><strong>Cachê:</strong> {fmtBRL(cacheTotal)}</p>
            )}

            {isExcecaoCache && canSeeExcecao && (
              <div className="rounded-md border border-yellow-500/50 bg-yellow-500/10 px-3 py-2 text-sm flex gap-2 items-start">
                <AlertTriangle className="h-4 w-4 mt-0.5 text-yellow-600 dark:text-yellow-400" />
                <div>
                  <p className="font-medium">Exceção de cachê — abaixo do mínimo</p>
                  <p className="text-muted-foreground">
                    Cachê: {fmtBRL(cacheTotal)} · Mínimo do artista: {fmtBRL(cacheMin)}. Salvo como exceção pela gerência.
                  </p>
                </div>
              </div>
            )}

            {canSeeAutorizado && (show.autorizado_por_nome || show.autorizado_por) && (
              <p className="text-xs text-muted-foreground">
                <strong>Autorizado por:</strong>{" "}
                {show.autorizado_por_nome ?? show.autorizado_por}
                {show.autorizado_em && (
                  <> em {format(new Date(show.autorizado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</>
                )}
              </p>
            )}

            {show.confirmado_sem_pagamento && (isDiretor || isFinanceiro) && (
              <div className="rounded-md border border-yellow-500/50 bg-yellow-500/10 px-3 py-2 text-sm space-y-1">
                <p className="font-medium text-yellow-700 dark:text-yellow-400">
                  ✓ Confirmado sem pagamento
                </p>
                {show.confirmado_sem_pagamento_motivo && (
                  <p className="text-muted-foreground text-xs">
                    <strong>Motivo:</strong> {show.confirmado_sem_pagamento_motivo}
                  </p>
                )}
                {show.confirmado_por_nome && (
                  <p className="text-muted-foreground text-xs">
                    Por {show.confirmado_por_nome}
                    {show.confirmado_em && (
                      <> em {format(new Date(show.confirmado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</>
                    )}
                  </p>
                )}
              </div>
            )}

            {canManageActions && show.status !== "cancelada" && (
              <div className="border-t pt-3 space-y-2">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Ações {isDiretor ? "da diretoria" : "de gerência"}
                </p>
                <div className="flex flex-wrap gap-2">
                  {show.status === "pendente" && canApproveOrReject && (
                    <>
                      <Button size="sm" onClick={approve} disabled={busy}>Aprovar</Button>
                      <Button size="sm" variant="outline" onClick={() => setShowReject((v) => !v)} disabled={busy}>Rejeitar</Button>
                    </>
                  )}
                  {show.status === "pendente" && !canApproveOrReject && (
                    <p className="text-xs text-muted-foreground">
                      Apenas o Diretor pode aprovar ou rejeitar minutas.
                    </p>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setShowResched((v) => !v)} disabled={busy}>Remarcar</Button>
                  <Button size="sm" variant="destructive" onClick={cancel} disabled={busy}>Cancelar show</Button>
                </div>

                {showReject && canApproveOrReject && (
                  <div className="space-y-2 rounded-md border p-3">
                    <Label>Motivo da rejeição</Label>
                    <Textarea rows={2} value={rejectMotivo} onChange={(e) => setRejectMotivo(e.target.value)} />
                    <Button size="sm" onClick={reject} disabled={busy}>Confirmar rejeição</Button>
                  </div>
                )}

                {showResched && (
                  <div className="space-y-2 rounded-md border p-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>Nova data</Label>
                        <Input type="date" value={reschedDate} onChange={(e) => setReschedDate(e.target.value)} />
                      </div>
                      <div>
                        <Label>Novo horário</Label>
                        <Input type="time" value={reschedTime} onChange={(e) => setReschedTime(e.target.value)} />
                      </div>
                    </div>
                    <Label>Motivo</Label>
                    <Textarea rows={2} value={reschedMotivo} onChange={(e) => setReschedMotivo(e.target.value)} />
                    <Button size="sm" onClick={reschedule} disabled={busy}>Confirmar remarcação</Button>
                  </div>
                )}
              </div>
            )}

            {canDeleteShow && (
              <div className="border-t pt-3">
                <Button size="sm" variant="destructive" onClick={deleteMinuta} disabled={busy}>
                  Excluir minuta
                </Button>
              </div>
            )}
          </TabsContent>

          {!isArtista && (
            <TabsContent value="cronograma">
              <PaymentScheduleEditor
                showId={show.id}
                cacheTotal={Number(show.cache_total ?? 0)}
                canEdit={isManager || isDiretor || roles.includes("equipe") || isFinanceiro || (roles.includes("vendedor") && !!isOwner)}
                onChanged={onChanged}
              />
            </TabsContent>
          )}

          {!isArtista && (
            <TabsContent value="financeiro">
              <ErrorBoundary label="PaymentsTab">
                <PaymentsTab
                  showId={show.id}
                  status={show.status}
                  confirmadoPorNome={show.confirmado_por_nome}
                  confirmadoEm={show.confirmado_em}
                  artistNome={show.artist_nome}
                  showDate={show.data_show}
                  showLocal={[show.local, show.cidade].filter(Boolean).join(" · ") || null}
                  onChanged={onChanged}
                />
              </ErrorBoundary>
            </TabsContent>
          )}

          {!isArtista && (
            <TabsContent value="anexos">
              <ErrorBoundary label="AttachmentsTab">
                <AttachmentsTab
                  showId={show.id}
                  artistNome={show.artist_nome}
                  showDate={show.data_show}
                  canUpload={canUpload}
                />
              </ErrorBoundary>
            </TabsContent>
          )}
          {(isManager || isDiretor || isFinanceiro) && (
            <TabsContent value="historico">
              <StatusHistoryTab showId={show.id} />
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
