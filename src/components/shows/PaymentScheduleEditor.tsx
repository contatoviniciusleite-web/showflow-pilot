import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface ScheduleItem {
  id?: string;
  ordem: number;
  descricao: string;
  data_prevista: string; // yyyy-MM-dd
  percentual: number | null;
  valor: number;
  observacoes: string;
}

function fmtBRL(n: number) {
  return Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/* ------------------------------------------------------------------ */
/* Editor "burro" controlado pelo pai — usado dentro do form da minuta */
/* ------------------------------------------------------------------ */
interface RowsProps {
  items: ScheduleItem[];
  onChange: (next: ScheduleItem[]) => void;
  cacheTotal: number;
  canEdit: boolean;
  totalPago?: number;
  showSummary?: boolean;
}

export function PaymentScheduleRows({
  items, onChange, cacheTotal, canEdit, totalPago = 0, showSummary = true,
}: RowsProps) {
  const update = (idx: number, patch: Partial<ScheduleItem>) => {
    onChange(items.map((it, i) => {
      if (i !== idx) return it;
      const next = { ...it, ...patch };
      if ("percentual" in patch && next.percentual !== null && cacheTotal > 0) {
        next.valor = Math.round(cacheTotal * (next.percentual / 100) * 100) / 100;
      }
      return next;
    }));
  };
  const addRow = () => {
    onChange([
      ...items,
      { ordem: items.length, descricao: "", data_prevista: "", percentual: null, valor: 0, observacoes: "" },
    ]);
  };
  const removeRow = (idx: number) =>
    onChange(items.filter((_, i) => i !== idx).map((it, i) => ({ ...it, ordem: i })));

  const totalPrevisto = items.reduce((s, it) => s + Number(it.valor || 0), 0);
  const totalPercentual = items.reduce((s, it) => s + Number(it.percentual ?? 0), 0);
  const saldo = Math.max(0, cacheTotal - totalPago);

  return (
    <div className="space-y-3">
      {showSummary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
          <div className="rounded-md border p-2">
            <p className="text-xs text-muted-foreground">Cachê</p>
            <p className="font-semibold">{fmtBRL(cacheTotal)}</p>
          </div>
          <div className="rounded-md border p-2">
            <p className="text-xs text-muted-foreground">Previsto</p>
            <p className="font-semibold">{fmtBRL(totalPrevisto)}</p>
          </div>
          <div className="rounded-md border p-2">
            <p className="text-xs text-muted-foreground">Pago</p>
            <p className="font-semibold text-emerald-600 dark:text-emerald-400">{fmtBRL(totalPago)}</p>
          </div>
          <div className="rounded-md border p-2">
            <p className="text-xs text-muted-foreground">Saldo a receber</p>
            <p className="font-semibold text-amber-600 dark:text-amber-400">{fmtBRL(saldo)}</p>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
          Nenhuma parcela adicionada.
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((it, idx) => (
            <li key={idx} className="rounded-md border p-3 space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <div className="sm:col-span-3">
                  <Label className="text-xs">Descrição</Label>
                  <Input
                    value={it.descricao} placeholder={`Parcela ${idx + 1}`} disabled={!canEdit}
                    onChange={(e) => update(idx, { descricao: e.target.value })}
                  />
                </div>
                <div className="sm:col-span-3">
                  <Label className="text-xs">Data prevista</Label>
                  <Input
                    type="date" value={it.data_prevista} disabled={!canEdit}
                    onChange={(e) => update(idx, { data_prevista: e.target.value })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs">% do cachê</Label>
                  <Input
                    type="number" inputMode="decimal" min={0} max={100} step="0.01"
                    value={it.percentual ?? ""} disabled={!canEdit}
                    onChange={(e) => {
                      const v = e.target.value;
                      update(idx, { percentual: v === "" ? null : Number(v) });
                    }}
                  />
                </div>
                <div className="sm:col-span-3">
                  <Label className="text-xs">Valor</Label>
                  <CurrencyInput
                    value={it.valor} disabled={!canEdit}
                    onValueChange={(v) => update(idx, { valor: v, percentual: null })}
                  />
                </div>
                <div className="sm:col-span-1 flex items-end justify-end">
                  {canEdit && (
                    <Button type="button" size="icon" variant="ghost" onClick={() => removeRow(idx)} title="Remover">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
              <div>
                <Label className="text-xs">Observações</Label>
                <Textarea
                  rows={2} value={it.observacoes} disabled={!canEdit}
                  onChange={(e) => update(idx, { observacoes: e.target.value })}
                  placeholder="Ex.: Sinal, condição especial, conta de destino…"
                />
              </div>
              {it.data_prevista && (() => {
                const d = new Date(`${it.data_prevista}T00:00:00`);
                return isNaN(d.getTime()) ? null : (
                  <p className="text-xs text-muted-foreground">
                    Vence em {format(d, "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                );
              })()}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button type="button" size="sm" variant="outline" onClick={addRow}>
            <Plus className="h-4 w-4 mr-2" /> Adicionar parcela
          </Button>
          <span className="text-xs text-muted-foreground">
            Soma %: <strong className={totalPercentual > 100 ? "text-destructive" : ""}>{totalPercentual.toFixed(2)}%</strong>
          </span>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Editor com carga/salvamento — usado na aba Cronograma do detalhe   */
/* ------------------------------------------------------------------ */
interface Props {
  showId: string;
  cacheTotal?: number;
  canEdit: boolean;
  onChanged?: () => void;
}

export function PaymentScheduleEditor({ showId, cacheTotal: cacheProp, canEdit, onChanged }: Props) {
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [totalPago, setTotalPago] = useState(0);
  const [cacheTotal, setCacheTotal] = useState(cacheProp ?? 0);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("shows-admin", {
      body: { action: "list_payment_schedule", show_id: showId },
    });
    if (error) { toast.error(error.message); setLoading(false); return; }
    const parcelas = (data?.schedule ?? []).map((r: any, i: number) => ({
      id: r.id,
      ordem: r.ordem ?? i,
      descricao: r.descricao ?? "",
      data_prevista: r.data_prevista ?? "",
      percentual: r.percentual === null ? null : Number(r.percentual),
      valor: Number(r.valor ?? 0),
      observacoes: r.observacoes ?? "",
    }));
    setItems(parcelas);
    setTotalPago(Number(data?.total_pago ?? 0));
    setCacheTotal(Number(data?.cache_total ?? cacheProp ?? 0));
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [showId]);

  const save = async () => {
    setSaving(true);
    const payload = items.map((it, i) => ({ ...it, ordem: i }));
    const { error } = await supabase.functions.invoke("shows-admin", {
      body: { action: "save_payment_schedule", show_id: showId, items: payload },
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Cronograma salvo");
    onChanged?.();
    load();
  };

  if (loading) return <p className="text-sm text-muted-foreground">Carregando cronograma…</p>;

  return (
    <div className="space-y-4">
      <PaymentScheduleRows
        items={items} onChange={setItems}
        cacheTotal={cacheTotal} canEdit={canEdit} totalPago={totalPago}
      />
      {canEdit && (
        <div className="flex justify-end">
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Salvar cronograma
          </Button>
        </div>
      )}
    </div>
  );
}
