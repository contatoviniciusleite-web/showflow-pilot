import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { REVENUE_TYPES } from "@/lib/producerFinance";

type Artist = { id: string; nome: string };
type Revenue = {
  id?: string;
  tipo: string;
  descricao: string;
  artist_id: string | null;
  valor: number;
  data_recebimento: string;
  distribuidora: string | null;
  periodo_referencia: string | null;
  observacoes: string | null;
  recorrente?: boolean;
};

export function RevenueDialog({
  open, onOpenChange, revenue, artists, onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  revenue: Revenue | null;
  artists: Artist[];
  onDone: () => void;
}) {
  const { user } = useAuth();
  const [tipo, setTipo] = useState("streaming");
  const [descricao, setDescricao] = useState("");
  const [artistId, setArtistId] = useState<string>("none");
  const [valor, setValor] = useState(0);
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [distribuidora, setDistribuidora] = useState("");
  const [periodo, setPeriodo] = useState("");
  const [obs, setObs] = useState("");
  const [recorrente, setRecorrente] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTipo(revenue?.tipo ?? "streaming");
      setDescricao(revenue?.descricao ?? "");
      setArtistId(revenue?.artist_id ?? "none");
      setValor(revenue?.valor ?? 0);
      setData(revenue?.data_recebimento ?? new Date().toISOString().slice(0, 10));
      setDistribuidora(revenue?.distribuidora ?? "");
      setPeriodo(revenue?.periodo_referencia ?? "");
      setObs(revenue?.observacoes ?? "");
      setRecorrente(revenue?.recorrente ?? false);
      setFile(null);
    }
  }, [open, revenue]);

  const submit = async () => {
    if (!descricao.trim()) return toast.error("Descrição é obrigatória");
    if (valor <= 0) return toast.error("Valor inválido");
    setSaving(true);
    try {
      let comprovante_path: string | null = null;
      if (file) {
        const ext = file.name.split(".").pop();
        const path = `receitas/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const up = await supabase.storage.from("financeiro-produtora").upload(path, file);
        if (up.error) throw up.error;
        comprovante_path = path;
      }
      const payload: any = {
        tipo, descricao, artist_id: artistId === "none" ? null : artistId,
        valor, data_recebimento: data,
        distribuidora: tipo === "streaming" ? (distribuidora || null) : null,
        periodo_referencia: periodo || null,
        observacoes: obs || null,
        recorrente,
        ...(comprovante_path ? { comprovante_path } : {}),
      };
      if (revenue?.id) {
        const { error } = await supabase.from("producer_revenues" as any).update(payload).eq("id", revenue.id);
        if (error) throw error;
      } else {
        payload.created_by = user?.id ?? null;
        const { error } = await supabase.from("producer_revenues" as any).insert(payload);
        if (error) throw error;

        // Cria modelo recorrente se solicitado
        if (recorrente && tipo === "streaming") {
          await supabase.from("producer_recurring_revenues" as any).insert({
            tipo, descricao,
            artist_id: artistId === "none" ? null : artistId,
            valor,
            distribuidora: distribuidora || null,
            dia_recebimento: new Date(data).getDate(),
            ativo: true,
          });
        }
      }
      toast.success("Receita salva");
      onDone();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Erro");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{revenue?.id ? "Editar receita" : "Nova receita"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REVENUE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data de recebimento</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Descrição</Label>
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Artista (opcional)</Label>
              <Select value={artistId} onValueChange={setArtistId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Nenhum —</SelectItem>
                  {artists.map((a) => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Valor</Label>
              <CurrencyInput value={valor} onValueChange={setValor} />
            </div>
          </div>
          {tipo === "streaming" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Distribuidora</Label>
                <Input value={distribuidora} onChange={(e) => setDistribuidora(e.target.value)} placeholder="Ex: ONErpm, DistroKid" />
              </div>
              <div>
                <Label>Período referência</Label>
                <Input value={periodo} onChange={(e) => setPeriodo(e.target.value)} placeholder="Ex: Janeiro 2026" />
              </div>
            </div>
          )}
          {tipo !== "streaming" && (
            <div>
              <Label>Período referência (opcional)</Label>
              <Input value={periodo} onChange={(e) => setPeriodo(e.target.value)} />
            </div>
          )}
          <div>
            <Label>Comprovante (opcional)</Label>
            <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} />
          </div>
          {tipo === "streaming" && !revenue?.id && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={recorrente} onCheckedChange={(v) => setRecorrente(!!v)} />
              Adicionar como receita recorrente mensal
            </label>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
