import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { CurrencyInput } from "@/components/ui/currency-input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { monthRefOf } from "@/lib/producerFinance";
import {
  EXPENSE_CATEGORIES_V2, getCategoria,
  TIPO_DESPESA_OPTIONS, CENTRO_CUSTO_OPTIONS,
  DEPARTAMENTO_OPTIONS, TIPO_CONTRATO_OPTIONS,
  TIPO_CONTA_OPTIONS, TIPO_CHAVE_PIX_OPTIONS, BANCOS_BR,
} from "@/lib/expenseCategories";

type Expense = any;
type Artist = { id: string; nome: string };

function addMonths(iso: string, n: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1 + n, d);
  // Ajusta para último dia se mês não tiver
  if (dt.getMonth() !== ((m - 1 + n) % 12 + 12) % 12) {
    dt.setDate(0);
  }
  return dt.toISOString().slice(0, 10);
}

export function ExpenseDialog({
  open, onOpenChange, expense, onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  expense: Expense | null;
  onDone: () => void;
}) {
  const { user } = useAuth();

  // Básicos
  const [categoria, setCategoria] = useState<string>("funcionamento");
  const [subcategoria, setSubcategoria] = useState<string>("");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState(0);
  const [vencimento, setVencimento] = useState(new Date().toISOString().slice(0, 10));
  const [responsavel, setResponsavel] = useState("");

  // Parcelamento
  const [parcelado, setParcelado] = useState(false);
  const [totalParcelas, setTotalParcelas] = useState(2);
  const [valorParcela, setValorParcela] = useState(0);
  const [valorParcelaEdited, setValorParcelaEdited] = useState(false);

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

  // Equipe
  const [beneficiario, setBeneficiario] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [departamento, setDepartamento] = useState("Produção");
  const [tipoContrato, setTipoContrato] = useState("PJ");
  const [salvarFornecedor, setSalvarFornecedor] = useState(false);

  // Outros
  const [obs, setObs] = useState("");
  const [tags, setTags] = useState("");

  const [artists, setArtists] = useState<Artist[]>([]);
  const [saving, setSaving] = useState(false);

  const catDef = useMemo(() => getCategoria(categoria), [categoria]);
  const isEquipe = categoria === "equipe";
  const isVideoclipe = categoria === "videoclipe";
  const showBancarios = forma === "pix" || forma === "ted" || forma === "transferencia";
  const showPix = forma === "pix";

  useEffect(() => {
    if (!open) return;
    supabase.from("artists").select("id, nome").eq("ativo", true).order("nome")
      .then(({ data }) => setArtists((data ?? []) as any));
  }, [open]);

  useEffect(() => {
    if (open) {
      const e = expense ?? {};
      setCategoria(e.categoria ?? "funcionamento");
      setSubcategoria(e.subcategoria ?? "");
      setDescricao(e.descricao ?? "");
      setValor(Number(e.valor ?? 0));
      setVencimento(e.data_vencimento ?? new Date().toISOString().slice(0, 10));
      setResponsavel(e.responsavel ?? "");
      setParcelado(!!e.parcelado);
      setTotalParcelas(e.total_parcelas ?? 2);
      setValorParcela(Number(e.valor ?? 0));
      setValorParcelaEdited(false);
      setTipoDespesa(e.tipo_despesa ?? "custo_operacional");
      setArtistId(e.artist_id ?? "none");
      setProjeto(e.projeto ?? "");
      setCentroCusto(e.centro_custo ?? "produtora");
      setForma(e.forma_pagamento ?? "pix");
      setBanco(e.banco ?? "");
      setAgencia(e.agencia ?? "");
      setConta(e.conta ?? "");
      setTipoConta(e.tipo_conta ?? "Corrente");
      setTipoChavePix(e.tipo_chave_pix ?? "CPF");
      setChavePix(e.chave_pix ?? "");
      setBeneficiario(e.beneficiario ?? "");
      setCpfCnpj(e.cpf_cnpj ?? "");
      setDepartamento(e.departamento ?? "Produção");
      setTipoContrato(e.tipo_contrato ?? "PJ");
      setSalvarFornecedor(false);
      setObs(e.observacoes ?? "");
      setTags(e.tags ?? "");
    }
  }, [open, expense]);

  // Recalcula valor da parcela quando valor/total muda (a menos que o usuário tenha editado manualmente)
  useEffect(() => {
    if (parcelado && !valorParcelaEdited && totalParcelas > 0) {
      setValorParcela(Number((valor / totalParcelas).toFixed(2)));
    }
  }, [valor, totalParcelas, parcelado, valorParcelaEdited]);

  // Reset subcategoria quando categoria muda
  useEffect(() => { setSubcategoria(""); }, [categoria]);

  const isEditing = !!expense?.id;

  const submit = async () => {
    if (!descricao.trim()) return toast.error("Descrição é obrigatória");
    if (!subcategoria) return toast.error("Selecione a subcategoria");
    if (valor <= 0) return toast.error("Valor inválido");
    if (parcelado && (totalParcelas < 1 || totalParcelas > 60)) return toast.error("Parcelas: 1 a 60");
    if (isEquipe && !beneficiario.trim()) return toast.error("Nome / Razão Social é obrigatório para Equipe");

    setSaving(true);
    try {
      const baseExtra: any = {
        subcategoria,
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
        tags: tags || null,
        observacoes: obs || null,
        forma_pagamento: forma || null,
        beneficiario: beneficiario || null,
      };

      if (isEditing) {
        const payload = {
          ...baseExtra,
          categoria, descricao, valor,
          data_vencimento: vencimento,
          mes_referencia: monthRefOf(new Date(vencimento)),
        };
        const { error } = await supabase.from("producer_expenses" as any)
          .update(payload).eq("id", expense.id);
        if (error) throw error;
      } else if (parcelado) {
        const grupoId = (crypto as any).randomUUID();
        const valorPorParcela = Number(valorParcela.toFixed(2));
        const rows = Array.from({ length: totalParcelas }, (_, i) => {
          const dataVenc = i === 0 ? vencimento : addMonths(vencimento, i);
          return {
            ...baseExtra,
            categoria,
            descricao: `${descricao} (${i + 1}/${totalParcelas})`,
            valor: valorPorParcela,
            data_vencimento: dataVenc,
            mes_referencia: monthRefOf(new Date(dataVenc)),
            parcelado: true,
            total_parcelas: totalParcelas,
            numero_parcela: i + 1,
            parcela_grupo_id: grupoId,
            status: "pendente",
            recorrente: false,
            created_by: user?.id ?? null,
          };
        });
        const { error } = await supabase.from("producer_expenses" as any).insert(rows);
        if (error) throw error;
      } else {
        const payload = {
          ...baseExtra,
          categoria, descricao, valor,
          data_vencimento: vencimento,
          mes_referencia: monthRefOf(new Date(vencimento)),
          status: "pendente",
          recorrente: false,
          parcelado: false,
          created_by: user?.id ?? null,
        };
        const { error } = await supabase.from("producer_expenses" as any).insert(payload);
        if (error) throw error;
      }

      // Salvar como fornecedor fixo (Equipe)
      if (!isEditing && isEquipe && salvarFornecedor && beneficiario.trim()) {
        await supabase.from("fornecedores" as any).insert({
          nome: beneficiario,
          tipo: "Equipe",
          banco: banco || null,
          agencia: agencia || null,
          conta: conta || null,
          chave_pix: chavePix || null,
          telefone: null,
          ativo: true,
          observacoes: `${departamento} • ${tipoContrato}${cpfCnpj ? " • " + cpfCnpj : ""}`,
        }).then(({ error }) => {
          if (error) console.error("Falha ao salvar fornecedor:", error.message);
        });
      }

      toast.success(parcelado && !isEditing ? `${totalParcelas} parcelas criadas` : "Despesa salva");
      onDone();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar despesa" : "Nova despesa"}</DialogTitle>
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
              <Label>Valor total *</Label>
              <CurrencyInput value={valor} onValueChange={setValor} />
            </div>
            <div>
              <Label>Vencimento *</Label>
              <Input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Responsável pelo pagamento</Label>
            <Input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} placeholder="Quem vai efetuar o pagamento" />
          </div>

          {/* Parcelamento */}
          {!isEditing && (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">É parcelado?</Label>
                  <Switch checked={parcelado} onCheckedChange={setParcelado} />
                </div>
                {parcelado && (
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label>Nº de parcelas</Label>
                      <Input type="number" min={1} max={60} value={totalParcelas}
                        onChange={(e) => { setTotalParcelas(Number(e.target.value)); setValorParcelaEdited(false); }} />
                    </div>
                    <div>
                      <Label>Valor por parcela</Label>
                      <CurrencyInput value={valorParcela}
                        onValueChange={(v) => { setValorParcela(v); setValorParcelaEdited(true); }} />
                    </div>
                    <div>
                      <Label>1ª parcela</Label>
                      <Input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

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
                <Label>Artista vinculado{isVideoclipe ? " *" : " (opcional)"}</Label>
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

          {/* Equipe — campos extras */}
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

          {/* Beneficiário (não-equipe) */}
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
                  <SelectItem value="ted">TED / Transferência</SelectItem>
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
                  <Label>Agência</Label>
                  <Input value={agencia} onChange={(e) => setAgencia(e.target.value)} />
                </div>
                <div>
                  <Label>Conta</Label>
                  <Input value={conta} onChange={(e) => setConta(e.target.value)} />
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
                {showPix && (
                  <>
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
                  </>
                )}
              </div>
            )}

            {isEquipe && !isEditing && (
              <div className="flex items-center gap-2 pt-1">
                <Checkbox id="save-fornecedor" checked={salvarFornecedor}
                  onCheckedChange={(v) => setSalvarFornecedor(!!v)} />
                <Label htmlFor="save-fornecedor" className="text-sm font-normal cursor-pointer">
                  Salvar como beneficiário fixo (cadastrar em fornecedores)
                </Label>
              </div>
            )}
          </div>

          {/* Observações + tags */}
          <Separator />
          <div className="grid grid-cols-1 gap-3">
            <div>
              <Label>Tags (separadas por vírgula)</Label>
              <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="ex: turnê, sul, marketing-q1" />
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
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {parcelado && !isEditing ? `Criar ${totalParcelas} parcelas` : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
