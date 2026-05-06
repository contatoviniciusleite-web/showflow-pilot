import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  REVENUE_TYPES, STREAMING_PLATFORMS, SPONSORSHIP_TYPES,
  MERCH_PRODUCT_TYPES, MERCH_CHANNELS, LICENSE_TYPES, EVENT_REVENUE_TYPES,
} from "@/lib/producerFinance";

type Artist = { id: string; nome: string };

export function RevenueDialog({
  open, onOpenChange, revenue, artists, onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  revenue: any | null;
  artists: Artist[];
  onDone: () => void;
}) {
  const { user } = useAuth();
  const [tipo, setTipo] = useState("streaming");
  const [descricao, setDescricao] = useState("");
  const [artistId, setArtistId] = useState<string>("none");
  const [artistaVinculo, setArtistaVinculo] = useState<"produtora" | "artista">("artista");
  const [valor, setValor] = useState(0);
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [obs, setObs] = useState("");
  const [recorrente, setRecorrente] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"recebido" | "a_receber">("recebido");
  const [projeto, setProjeto] = useState("");
  const [tags, setTags] = useState("");

  // Streaming
  const [distribuidora, setDistribuidora] = useState("");
  const [periodo, setPeriodo] = useState("");
  const [plataformas, setPlataformas] = useState<string[]>([]);

  // Patrocínio
  const [nomeMarca, setNomeMarca] = useState("");
  const [tipoContrato, setTipoContrato] = useState("");
  const [vigInicio, setVigInicio] = useState("");
  const [vigFim, setVigFim] = useState("");
  const [valorContrato, setValorContrato] = useState(0);
  const [isParcela, setIsParcela] = useState(false);
  const [parcelaNum, setParcelaNum] = useState(1);
  const [parcelaTotal, setParcelaTotal] = useState(1);

  // Merch
  const [subcategoria, setSubcategoria] = useState("");
  const [quantidade, setQuantidade] = useState(0);
  const [valorUnitario, setValorUnitario] = useState(0);
  const [canalVenda, setCanalVenda] = useState("");

  // Licenciamento
  const [obraLicenciada, setObraLicenciada] = useState("");
  const [empresaContratante, setEmpresaContratante] = useState("");
  const [licInicio, setLicInicio] = useState("");
  const [licFim, setLicFim] = useState("");

  // Evento
  const [nomeEvento, setNomeEvento] = useState("");
  const [artistasEvento, setArtistasEvento] = useState<string[]>([]);
  const [localEvento, setLocalEvento] = useState("");
  const [cidadeEvento, setCidadeEvento] = useState("");
  const [valorBruto, setValorBruto] = useState(0);
  const [custosEvento, setCustosEvento] = useState(0);
  const [tipoReceitaEvento, setTipoReceitaEvento] = useState("");

  const isReadOnly = revenue?.tipo === "comissao_shows";

  useEffect(() => {
    if (open) {
      const r = revenue ?? {};
      setTipo(r.tipo ?? "streaming");
      setDescricao(r.descricao ?? "");
      setArtistId(r.artist_id ?? "none");
      setArtistaVinculo(r.artista_vinculo ?? "artista");
      setValor(Number(r.valor ?? 0));
      setData(r.data_recebimento ?? new Date().toISOString().slice(0, 10));
      setObs(r.observacoes ?? "");
      setRecorrente(r.recorrente ?? false);
      setStatus(r.status ?? "recebido");
      setProjeto(r.projeto ?? "");
      setTags(r.tags ?? "");
      setFile(null);
      setDistribuidora(r.distribuidora ?? "");
      setPeriodo(r.periodo_referencia ?? "");
      setPlataformas(Array.isArray(r.plataformas) ? r.plataformas : []);
      setNomeMarca(r.nome_marca ?? "");
      setTipoContrato(r.tipo_contrato ?? "");
      setVigInicio(r.vigencia_inicio ?? "");
      setVigFim(r.vigencia_fim ?? "");
      setValorContrato(Number(r.valor_total_contrato ?? 0));
      setIsParcela(!!r.parcela_total && r.parcela_total > 1);
      setParcelaNum(r.parcela_numero ?? 1);
      setParcelaTotal(r.parcela_total ?? 1);
      setSubcategoria(r.subcategoria ?? "");
      setQuantidade(r.quantidade ?? 0);
      setValorUnitario(Number(r.valor_unitario ?? 0));
      setCanalVenda(r.canal_venda ?? "");
      setObraLicenciada(r.obra_licenciada ?? "");
      setEmpresaContratante(r.empresa_contratante ?? "");
      setLicInicio(r.periodo_licenca_inicio ?? "");
      setLicFim(r.periodo_licenca_fim ?? "");
      setNomeEvento(r.nome_evento ?? "");
      setArtistasEvento(Array.isArray(r.artistas_evento) ? r.artistas_evento : []);
      setValorBruto(Number(r.valor_bruto ?? 0));
      setCustosEvento(Number(r.custos_evento ?? 0));
      setTipoReceitaEvento(r.subcategoria ?? "");
      setLocalEvento("");
      setCidadeEvento("");
    }
  }, [open, revenue]);

  // Auto valor total para merch
  useEffect(() => {
    if (tipo === "merch") setValor(quantidade * valorUnitario);
  }, [quantidade, valorUnitario, tipo]);

  // Auto descrição p/ alguns tipos
  useEffect(() => {
    if (tipo === "streaming" && distribuidora && periodo && !revenue?.id) {
      setDescricao(`Streaming ${distribuidora} — ${periodo}`);
    }
    if (tipo === "patrocinio" && nomeMarca && !revenue?.id) {
      setDescricao(`Patrocínio ${nomeMarca}`);
    }
    if (tipo === "evento" && nomeEvento && !revenue?.id) {
      setDescricao(nomeEvento);
    }
    if (tipo === "licenciamento" && obraLicenciada && empresaContratante && !revenue?.id) {
      setDescricao(`Licenciamento "${obraLicenciada}" — ${empresaContratante}`);
    }
  }, [tipo, distribuidora, periodo, nomeMarca, nomeEvento, obraLicenciada, empresaContratante, revenue?.id]);

  const togglePlataforma = (p: string) =>
    setPlataformas((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);

  const toggleArtistaEvento = (id: string) =>
    setArtistasEvento((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const liquidoEvento = valorBruto - custosEvento;

  const submit = async () => {
    if (isReadOnly) return;
    if (!descricao.trim()) return toast.error("Descrição é obrigatória");
    const valorFinal = tipo === "evento" ? liquidoEvento : valor;
    if (valorFinal <= 0) return toast.error("Valor inválido");
    if ((tipo === "streaming" || tipo === "licenciamento") && artistId === "none")
      return toast.error("Artista é obrigatório para este tipo");

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
        tipo,
        descricao,
        artist_id: artistId === "none" ? null : artistId,
        artista_vinculo: artistaVinculo,
        valor: valorFinal,
        data_recebimento: data,
        observacoes: obs || null,
        recorrente,
        status,
        projeto: projeto || null,
        tags: tags || null,
        periodo_referencia: periodo || null,
        ...(comprovante_path ? { comprovante_path } : {}),
      };

      if (tipo === "streaming") {
        payload.distribuidora = distribuidora || null;
        payload.plataformas = plataformas;
      }
      if (tipo === "patrocinio") {
        payload.nome_marca = nomeMarca || null;
        payload.tipo_contrato = tipoContrato || null;
        payload.vigencia_inicio = vigInicio || null;
        payload.vigencia_fim = vigFim || null;
        payload.valor_total_contrato = valorContrato || null;
        payload.parcela_numero = isParcela ? parcelaNum : null;
        payload.parcela_total = isParcela ? parcelaTotal : null;
      }
      if (tipo === "merch") {
        payload.subcategoria = subcategoria || null;
        payload.quantidade = quantidade || null;
        payload.valor_unitario = valorUnitario || null;
        payload.canal_venda = canalVenda || null;
      }
      if (tipo === "licenciamento") {
        payload.subcategoria = subcategoria || null;
        payload.obra_licenciada = obraLicenciada || null;
        payload.empresa_contratante = empresaContratante || null;
        payload.periodo_licenca_inicio = licInicio || null;
        payload.periodo_licenca_fim = licFim || null;
        payload.parcela_numero = isParcela ? parcelaNum : null;
        payload.parcela_total = isParcela ? parcelaTotal : null;
      }
      if (tipo === "evento") {
        payload.nome_evento = nomeEvento || null;
        payload.artistas_evento = artistasEvento;
        payload.valor_bruto = valorBruto;
        payload.custos_evento = custosEvento;
        payload.subcategoria = tipoReceitaEvento || null;
      }

      if (revenue?.id) {
        const { error } = await supabase.from("producer_revenues" as any).update(payload).eq("id", revenue.id);
        if (error) throw error;
      } else {
        payload.created_by = user?.id ?? null;
        const { error } = await supabase.from("producer_revenues" as any).insert(payload);
        if (error) throw error;

        if (recorrente && tipo === "streaming") {
          await supabase.from("producer_recurring_revenues" as any).insert({
            tipo, descricao,
            artist_id: artistId === "none" ? null : artistId,
            valor: valorFinal,
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{revenue?.id ? "Editar receita" : "Nova receita"}</DialogTitle>
        </DialogHeader>

        {isReadOnly && (
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <Badge variant="secondary" className="mb-1">Gerado automaticamente</Badge>
            <p className="text-muted-foreground">
              Esta receita foi gerada por um fechamento semanal e não pode ser editada manualmente.
            </p>
          </div>
        )}

        <div className={`space-y-4 ${isReadOnly ? "opacity-60 pointer-events-none" : ""}`}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo de receita *</Label>
              <Select value={tipo} onValueChange={setTipo} disabled={!!revenue?.id}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REVENUE_TYPES.filter((t) => t.value !== "comissao_shows" || revenue?.id).map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data do recebimento *</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
          </div>

          {/* === STREAMING === */}
          {tipo === "streaming" && (
            <div className="space-y-3 rounded-md border p-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Artista vinculado *</Label>
                  <Select value={artistId} onValueChange={setArtistId}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {artists.map((a) => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Gravadora / Distribuidora</Label>
                  <Input value={distribuidora} onChange={(e) => setDistribuidora(e.target.value)} placeholder="ONErpm, Warner..." />
                </div>
              </div>
              <div>
                <Label>Período de referência</Label>
                <Input value={periodo} onChange={(e) => setPeriodo(e.target.value)} placeholder="Ex: Janeiro 2026" />
              </div>
              <div>
                <Label>Plataformas incluídas</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {STREAMING_PLATFORMS.map((p) => (
                    <label key={p} className="flex items-center gap-1.5 text-sm border rounded-md px-2 py-1 cursor-pointer">
                      <Checkbox checked={plataformas.includes(p)} onCheckedChange={() => togglePlataforma(p)} />
                      {p}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <Label>Valor total recebido *</Label>
                <CurrencyInput value={valor} onValueChange={setValor} />
              </div>
            </div>
          )}

          {/* === PATROCÍNIO === */}
          {tipo === "patrocinio" && (
            <div className="space-y-3 rounded-md border p-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Artista vinculado (opcional)</Label>
                  <Select value={artistId} onValueChange={setArtistId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Produtora —</SelectItem>
                      {artists.map((a) => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Marca / Patrocinador *</Label>
                  <Input value={nomeMarca} onChange={(e) => setNomeMarca(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Tipo de contrato</Label>
                  <Select value={tipoContrato} onValueChange={setTipoContrato}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      {SPONSORSHIP_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Valor total do contrato</Label>
                  <CurrencyInput value={valorContrato} onValueChange={setValorContrato} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Vigência início</Label>
                  <Input type="date" value={vigInicio} onChange={(e) => setVigInicio(e.target.value)} />
                </div>
                <div>
                  <Label>Vigência fim</Label>
                  <Input type="date" value={vigFim} onChange={(e) => setVigFim(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Valor recebido neste lançamento *</Label>
                <CurrencyInput value={valor} onValueChange={setValor} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={isParcela} onCheckedChange={setIsParcela} />
                É parcela?
              </label>
              {isParcela && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Parcela número</Label>
                    <Input type="number" min={1} value={parcelaNum} onChange={(e) => setParcelaNum(+e.target.value || 1)} />
                  </div>
                  <div>
                    <Label>Total de parcelas</Label>
                    <Input type="number" min={1} value={parcelaTotal} onChange={(e) => setParcelaTotal(+e.target.value || 1)} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* === MERCH === */}
          {tipo === "merch" && (
            <div className="space-y-3 rounded-md border p-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Artista vinculado (opcional)</Label>
                  <Select value={artistId} onValueChange={setArtistId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Produtora —</SelectItem>
                      {artists.map((a) => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tipo de produto</Label>
                  <Select value={subcategoria} onValueChange={setSubcategoria}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      {MERCH_PRODUCT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Descrição do produto *</Label>
                <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Quantidade</Label>
                  <Input type="number" min={0} value={quantidade} onChange={(e) => setQuantidade(+e.target.value || 0)} />
                </div>
                <div>
                  <Label>Valor unitário</Label>
                  <CurrencyInput value={valorUnitario} onValueChange={setValorUnitario} />
                </div>
                <div>
                  <Label>Valor total</Label>
                  <CurrencyInput value={valor} onValueChange={setValor} />
                </div>
              </div>
              <div>
                <Label>Canal de venda</Label>
                <Select value={canalVenda} onValueChange={setCanalVenda}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {MERCH_CHANNELS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* === LICENCIAMENTO === */}
          {tipo === "licenciamento" && (
            <div className="space-y-3 rounded-md border p-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Artista vinculado *</Label>
                  <Select value={artistId} onValueChange={setArtistId}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {artists.map((a) => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tipo de licença</Label>
                  <Select value={subcategoria} onValueChange={setSubcategoria}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      {LICENSE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Música / Obra licenciada *</Label>
                <Input value={obraLicenciada} onChange={(e) => setObraLicenciada(e.target.value)} />
              </div>
              <div>
                <Label>Produtora / Empresa contratante</Label>
                <Input value={empresaContratante} onChange={(e) => setEmpresaContratante(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Período licença início</Label>
                  <Input type="date" value={licInicio} onChange={(e) => setLicInicio(e.target.value)} />
                </div>
                <div>
                  <Label>Período licença fim</Label>
                  <Input type="date" value={licFim} onChange={(e) => setLicFim(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Valor total *</Label>
                <CurrencyInput value={valor} onValueChange={setValor} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={isParcela} onCheckedChange={setIsParcela} />
                É parcela?
              </label>
              {isParcela && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Parcela número</Label>
                    <Input type="number" min={1} value={parcelaNum} onChange={(e) => setParcelaNum(+e.target.value || 1)} />
                  </div>
                  <div>
                    <Label>Total de parcelas</Label>
                    <Input type="number" min={1} value={parcelaTotal} onChange={(e) => setParcelaTotal(+e.target.value || 1)} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* === EVENTO === */}
          {tipo === "evento" && (
            <div className="space-y-3 rounded-md border p-3">
              <div>
                <Label>Nome do evento *</Label>
                <Input value={nomeEvento} onChange={(e) => setNomeEvento(e.target.value)} />
              </div>
              <div>
                <Label>Artistas envolvidos</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {artists.map((a) => (
                    <label key={a.id} className="flex items-center gap-1.5 text-sm border rounded-md px-2 py-1 cursor-pointer">
                      <Checkbox checked={artistasEvento.includes(a.id)} onCheckedChange={() => toggleArtistaEvento(a.id)} />
                      {a.nome}
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Local</Label>
                  <Input value={localEvento} onChange={(e) => setLocalEvento(e.target.value)} />
                </div>
                <div>
                  <Label>Cidade</Label>
                  <Input value={cidadeEvento} onChange={(e) => setCidadeEvento(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Tipo de receita do evento</Label>
                <Select value={tipoReceitaEvento} onValueChange={setTipoReceitaEvento}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {EVENT_REVENUE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Valor bruto</Label>
                  <CurrencyInput value={valorBruto} onValueChange={setValorBruto} />
                </div>
                <div>
                  <Label>Custos do evento</Label>
                  <CurrencyInput value={custosEvento} onValueChange={setCustosEvento} />
                </div>
                <div>
                  <Label>Valor líquido</Label>
                  <Input readOnly value={liquidoEvento.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} />
                </div>
              </div>
            </div>
          )}

          {/* === OUTRO / CLIPE / COMISSÃO (visualização) === */}
          {(tipo === "outro" || tipo === "clipe") && (
            <div className="space-y-3 rounded-md border p-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Artista (opcional)</Label>
                  <Select value={artistId} onValueChange={setArtistId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Produtora —</SelectItem>
                      {artists.map((a) => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Valor *</Label>
                  <CurrencyInput value={valor} onValueChange={setValor} />
                </div>
              </div>
            </div>
          )}

          {/* === DESCRIÇÃO === */}
          {tipo !== "merch" && (
            <div>
              <Label>Descrição *</Label>
              <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} />
            </div>
          )}

          {/* === CLASSIFICAÇÃO === */}
          <div className="space-y-3 rounded-md border p-3">
            <h4 className="text-sm font-semibold">Classificação</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Vínculo</Label>
                <Select value={artistaVinculo} onValueChange={(v) => setArtistaVinculo(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="produtora">Produtora</SelectItem>
                    <SelectItem value="artista">Artista</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recebido">Recebido</SelectItem>
                    <SelectItem value="a_receber">A receber</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Projeto</Label>
                <Input value={projeto} onChange={(e) => setProjeto(e.target.value)} placeholder="Ex: Álbum 2026" />
              </div>
              <div>
                <Label>Tags</Label>
                <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="separadas por vírgula" />
              </div>
            </div>
          </div>

          {/* === COMPROVANTE / OBS === */}
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
          {!isReadOnly && (
            <Button onClick={submit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salvar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
