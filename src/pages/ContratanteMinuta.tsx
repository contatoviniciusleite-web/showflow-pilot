import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle2, AlertCircle, CalendarDays, MapPin, Music2 } from "lucide-react";
import { formatCEP, formatCpfCnpj, formatPhoneBR } from "@/lib/masks";
import { toast } from "sonner";

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/contratante-link`;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface ShowSummary {
  artist_nome: string | null;
  data_show: string;
  horario: string | null;
  local: string | null;
  cidade: string | null;
  endereco: string | null;
  cache_total: number;
  condicao_pagamento: string | null;
  expires_at: string | null;
}

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

function fmtBRL(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtDate(d: string) {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

async function call(action: string, token: string, extra: any = {}) {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${ANON}` },
    body: JSON.stringify({ action, token, ...extra }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export default function ContratanteMinuta() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [preenchido, setPreenchido] = useState(false);
  const [show, setShow] = useState<ShowSummary | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    contratante_nome: "",
    contratante_documento: "",
    contratante_endereco: "",
    contratante_cidade: "",
    contratante_estado: "",
    contratante_cep: "",
    contratante_telefone: "",
    contratante_email: "",
    observacoes: "",
  });
  const setF = <K extends keyof typeof form>(k: K, v: string) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!token) { setError("Link inválido"); setLoading(false); return; }
    (async () => {
      const r = await call("get", token);
      setLoading(false);
      if (!r.ok) { setError(r.data?.error ?? "Link inválido"); return; }
      setExpired(!!r.data.expired);
      setPreenchido(!!r.data.preenchido);
      setShow(r.data.show);
    })();
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    const required: [keyof typeof form, string][] = [
      ["contratante_nome", "Nome / Razão social"],
      ["contratante_documento", "CPF / CNPJ"],
      ["contratante_endereco", "Endereço"],
      ["contratante_cidade", "Cidade"],
      ["contratante_estado", "Estado"],
      ["contratante_cep", "CEP"],
      ["contratante_telefone", "Telefone"],
      ["contratante_email", "E-mail"],
    ];
    for (const [k, label] of required) {
      if (!form[k]?.trim()) { toast.error(`Preencha: ${label}`); return; }
    }
    setSaving(true);
    const r = await call("submit", token, { form });
    setSaving(false);
    if (!r.ok) { toast.error(r.data?.error ?? "Erro ao enviar"); return; }
    setSubmitted(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <PageShell>
        <Card className="p-8 text-center">
          <AlertCircle className="h-10 w-10 mx-auto text-destructive mb-3" />
          <h2 className="text-lg font-semibold">Link inválido</h2>
          <p className="text-sm text-muted-foreground mt-2">{error}</p>
        </Card>
      </PageShell>
    );
  }

  if (expired) {
    return (
      <PageShell>
        <Card className="p-8 text-center">
          <AlertCircle className="h-10 w-10 mx-auto text-destructive mb-3" />
          <h2 className="text-lg font-semibold">Este link expirou</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Entre em contato com o vendedor para receber um novo link.
          </p>
        </Card>
      </PageShell>
    );
  }

  if (preenchido || submitted) {
    return (
      <PageShell>
        <Card className="p-8 text-center">
          <CheckCircle2 className="h-12 w-12 mx-auto text-green-600 mb-3" />
          <h2 className="text-lg font-semibold">
            {submitted ? "Dados recebidos com sucesso!" : "Estes dados já foram enviados"}
          </h2>
          <p className="text-sm text-muted-foreground mt-2">
            {submitted
              ? "Nossa equipe entrará em contato em breve para finalizar os detalhes do show."
              : "Obrigado!"}
          </p>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <Card className="p-6 md:p-8 mb-4">
        <h1 className="text-xl md:text-2xl font-semibold">Complete seus dados para confirmar o show</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Por favor, preencha as informações abaixo. O link expira em até 24 horas após sua geração.
        </p>
        {show && (
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <Info icon={<Music2 className="h-4 w-4" />} label="Artista" value={show.artist_nome ?? "—"} />
            <Info icon={<CalendarDays className="h-4 w-4" />} label="Data e horário"
              value={`${fmtDate(show.data_show)}${show.horario ? ` · ${show.horario}` : ""}`} />
            <Info icon={<MapPin className="h-4 w-4" />} label="Local"
              value={`${show.local ?? "—"}${show.cidade ? ` — ${show.cidade}` : ""}`} />
            <Info label="Cachê total" value={fmtBRL(Number(show.cache_total))} />
            {show.condicao_pagamento && (
              <div className="sm:col-span-2 rounded-md border p-3 bg-muted/30">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Condição de pagamento</p>
                <p className="text-sm whitespace-pre-wrap mt-1">{show.condicao_pagamento}</p>
              </div>
            )}
          </div>
        )}
      </Card>

      <Card className="p-6 md:p-8">
        <form onSubmit={submit} className="space-y-4">
          <h2 className="text-base font-semibold">Seus dados</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Nome completo / Razão social *</Label>
              <Input value={form.contratante_nome} onChange={(e) => setF("contratante_nome", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>CPF / CNPJ *</Label>
              <Input value={formatCpfCnpj(form.contratante_documento)}
                onChange={(e) => setF("contratante_documento", e.target.value.replace(/\D/g, ""))} />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone *</Label>
              <Input value={formatPhoneBR(form.contratante_telefone)}
                onChange={(e) => setF("contratante_telefone", e.target.value.replace(/\D/g, ""))} />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label>E-mail *</Label>
              <Input type="email" value={form.contratante_email}
                onChange={(e) => setF("contratante_email", e.target.value)} />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Endereço *</Label>
              <Input value={form.contratante_endereco}
                onChange={(e) => setF("contratante_endereco", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Cidade *</Label>
              <Input value={form.contratante_cidade}
                onChange={(e) => setF("contratante_cidade", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Estado *</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.contratante_estado} onChange={(e) => setF("contratante_estado", e.target.value)}>
                <option value="">Selecione</option>
                {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>CEP *</Label>
              <Input value={formatCEP(form.contratante_cep)}
                onChange={(e) => setF("contratante_cep", e.target.value.replace(/\D/g, ""))} />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Observações adicionais</Label>
              <Textarea rows={3} value={form.observacoes}
                onChange={(e) => setF("observacoes", e.target.value)}
                placeholder="Algo que devemos saber? (opcional)" />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirmar meus dados
          </Button>
        </form>
      </Card>
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center">
            <Music2 className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-semibold">Show Flow</span>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-6 md:py-10">{children}</main>
    </div>
  );
}

function Info({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      {icon && <span className="text-muted-foreground mt-0.5">{icon}</span>}
      <div className="min-w-0">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-sm truncate">{value}</p>
      </div>
    </div>
  );
}
