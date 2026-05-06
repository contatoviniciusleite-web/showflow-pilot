import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { CurrencyInput } from "@/components/ui/currency-input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  EXPENSE_CATEGORIES_V2, getCategoria,
  TIPO_DESPESA_OPTIONS, CENTRO_CUSTO_OPTIONS,
  DEPARTAMENTO_OPTIONS, TIPO_CONTRATO_OPTIONS,
  TIPO_CONTA_OPTIONS, TIPO_CHAVE_PIX_OPTIONS, BANCOS_BR,
} from "@/lib/expenseCategories";

type Recurring = any;
type Artist = { id: string; nome: string };

export function RecurringExpenseDialog({
  open, onOpenChange, recurring, onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  recurring: Recurring | null;
  onDone: () => void;
}) {
  // Básicos
  const [categoria, setCategoria] = useState("funcionamento");
  const [subcategoria, setSubcategoria] = useState("");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState(0);
  const [dia, setDia] = useState(5);

  // Classificação
  const [tipoDespesa, setTipoDespesa] = useState("custo_operacional");
  const [artistId, setArtistId] = useState<string>("none");
  const [projeto, setProjeto] = useState("");
  const [centroCusto, setCentroCusto] = useState("produtora");

  // Pagamento
  const [forma, setForma] = useState("pix");
  const [banco, setBanco] = useState("");
  const [agencia, setAgencia] = useState("");
  const [conta, setConta] = useState("");
  const [tipoConta, setTipoConta] = useState<string>("Corrente");
  const [tipoChavePix, setTipoChavePix] = useState<string>("CPF");
  const [chavePix, setChavePix] = useState("");

  // Equipe / beneficiário
  const [beneficiario, setBeneficiario] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [departamento, setDepartamento] = useState("Produção");
  const [tipoContrato, setTipoContrato] = useState("PJ");

  // Outros
  const [obs, setObs] = useState("");
  const [tags, setTags] = useState("");

  const [artists, setArtists] = useState<Artist[]>([]);
  const [saving, setSaving] = useState(false);

  const catDef = useMemo(() => getCategoria(categoria), [categoria]);
  const isEquipe = categoria === "equipe";
  const showBancarios = forma === "pix" || forma === "ted" || forma === "transferencia";
  const showPix = forma === "pix";
  const isEditing = !!recurring?.id;

  useEffect(() => {
    if (!open) return;
    supabase.from("artists").select("id, nome").eq("ativo", true).order("nome")
      .then(({ data }) => setArtists((data ?? []) as any));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const r = recurring ?? {};
    setCategoria(r.categoria ?? "funcionamento");
    setSubcategoria(r.subcategoria ?? "");
    setDescricao(r.descricao ?? "");
    setValor(Number(r.valor ?? 0));
    setDia(r.dia_vencimento ?? 5);
    setTipoDespesa(r.tipo_despesa ?? "custo_operacional");
    setArtistId(r.artist_id ?? "none");
    setProjeto(r.projeto ?? "");
    setCentroCusto(r.centro_custo ?? "produtora");
    setForma(r.forma_pagamento_padrao ?? "pix");
    setBanco(r.banco ?? "");
    setAgencia(r.agencia ?? "");
    setConta(r.conta ?? "");
    setTipoConta(r.tipo_conta ?? "Corrente");
    setTipoChavePix(r.tipo_chave_pix ?? "CPF");
    setChavePix(r.chave_pix ?? "");
    setBeneficiario(r.beneficiario ?? "");
    setCpfCnpj(r.cpf_cnpj ?? "");
    setDepartamento(r.departamento ?? "Produção");
    setTipoContrato(r.tipo_contrato ?? "PJ");
    setObs(r.observacoes ?? "");
    setTags(r.tags ?? "");
  }, [open, recurring]);

  useEffect(() => { if (open) setSubcategoria(recurring?.subcategoria ?? ""); }, [categoria]);

  const submit = async () => {
    if (!descricao.trim()) return toast.error("Descrição é obrigatória");
    if (!subcategoria) return toast.error("Selecione a subcategoria");
    if (valor <= 0) return toast.error("Valor inválido");
    if (dia < 1 || dia > 31) return toast.error("Dia inválido (1-31)");
    if (isEquipe && !beneficiario.trim()) return toast.error("Nome / Razão Social é obrigatório para Equipe");

    setSaving(true);
    try {
      const payload: any = {
        categoria,
        subcategoria,
        descricao,
        valor,
        dia_vencimento: dia,
        forma_pagamento_padrao: forma || null,
        observacoes: obs || null,
        ativo: true,
        tipo_despesa: tipoDespesa,
        artist_id: artistId === "none" ? null : artistId,
        projeto: projeto || null,
        centro_custo: centroCusto || null,
        banco: showBancarios ? (banco || null) : null,
        agencia: showBancarios ? (agencia || null) : null,
        conta: showBancarios ? (conta || null) : null,
        tipo_conta: showBancarios ? tipoConta : null,
        chave_pix: showPix ? (chavePix || null) : null,
        tipo_chave_pix: showPix ? tipoChavePix : null,
        departamento: isEquipe ? departamento : null,
        tipo_contrato: isEquipe ? tipoContrato : null,
        cpf_cnpj: isEquipe ? (cpfCnpj || null) : null,
        beneficiario: beneficiario || null,
        tags: tags || null,
      };
      if (isEditing) {
        const { error } = await supabase.from("producer_recurring_expenses" as any).update(payload).eq("id", recurring.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("producer_recurring_expenses" as any).insert(payload);
        if (error) throw error;
      }
      toast.success("Despesa recorrente salva");
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
          <DialogTitle>{isEditing ? "Editar recorrente" : "Nova despesa recorrente"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Categoria + subcategoria */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Categoria *</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES_V2.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.icon} {c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Subcategoria *</Label>
              <Select value={subcategoria} onValueChange={setSubcategoria} disabled={!catDef}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {catDef?.subcategorias.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Descrição *</Label>
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Valor *</Label>
              <CurrencyInput value={valor} onValueChange={setValor} />
            </div>
            <div>
              <Label>Dia do vencimento (1-31) *</Label>
              <Input type="number" min={1} max={31} value={dia} onChange={(e) => setDia(Number(e.target.value))} />
            </div>
          </div>

          {/* Classificação */}
          <Separator />
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Classificação</Label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo de despesa</Label>
                <Select value={tipoDespesa} onValueChange={setTipoDespesa}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPO_DESPESA_OPTIONS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Centro de custo</Label>
                <Select value={centroCusto} onValueChange={setCentroCusto}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CENTRO_CUSTO_OPTIONS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Artista vinculado (opcional)</Label>
                <Select value={artistId} onValueChange={setArtistId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Nenhum —</SelectItem>
                    {artists.map((a) => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Projeto</Label>
                <Input value={projeto} onChange={(e) => setProjeto(e.target.value)} placeholder='Ex: "Álbum 2026"' />
              </div>
            </div>
          </div>

          {/* Equipe extras */}
          {isEquipe && (
            <>
              <Separator />
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Dados da pessoa / empresa</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Nome / Razão Social *</Label>
                    <Input value={beneficiario} onChange={(e) => setBeneficiario(e.target.value)} />
                  </div>
                  <div>
                    <Label>CPF / CNPJ</Label>
                    <Input value={cpfCnpj} onChange={(e) => setCpfCnpj(e.target.value)} />
                  </div>
                  <div>
                    <Label>Departamento</Label>
                    <Select value={departamento} onValueChange={setDepartamento}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DEPARTAMENTO_OPTIONS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Tipo de contrato</Label>
                    <Select value={tipoContrato} onValueChange={setTipoContrato}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TIPO_CONTRATO_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </>
          )}

          {!isEquipe && (
            <div>
              <Label>Beneficiário</Label>
              <Input value={beneficiario} onChange={(e) => setBeneficiario(e.target.value)} />
            </div>
          )}

          {/* Pagamento */}
          <Separator />
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Pagamento</Label>
            <div>
              <Label>Forma de pagamento</Label>
              <Select value={forma} onValueChange={setForma}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="transferencia">Transferência</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                  <SelectItem value="cartao">Cartão</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {showBancarios && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Banco</Label>
                  <Select value={banco} onValueChange={setBanco}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {BANCOS_BR.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tipo de conta</Label>
                  <Select value={tipoConta} onValueChange={setTipoConta}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIPO_CONTA_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Agência</Label>
                  <Input value={agencia} onChange={(e) => setAgencia(e.target.value)} />
                </div>
                <div>
                  <Label>Conta</Label>
                  <Input value={conta} onChange={(e) => setConta(e.target.value)} />
                </div>
              </div>
            )}

            {showPix && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Tipo de chave PIX</Label>
                  <Select value={tipoChavePix} onValueChange={setTipoChavePix}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIPO_CHAVE_PIX_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Chave PIX</Label>
                  <Input value={chavePix} onChange={(e) => setChavePix(e.target.value)} />
                </div>
              </div>
            )}
          </div>

          {/* Outros */}
          <Separator />
          <div className="space-y-3">
            <div>
              <Label>Tags</Label>
              <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="separadas por vírgula" />
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={obs} onChange={(e) => setObs(e.target.value)} />
            </div>
          </div>
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
