import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Music2, Users, Wallet, Clock, CheckCircle2, XCircle, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface ShowLite {
  id: string;
  artist_nome?: string | null;
  data_show: string;
  status:
    | "pendente"
    | "aprovada"
    | "aguardando_pagamento"
    | "comprovante_enviado"
    | "confirmado"
    | "cancelado";
  cache_total: number;
  local: string | null;
  cidade: string | null;
  prazo_comprovante_em?: string | null;
}
interface NotificationLite {
  id: string;
  tipo: "minuta_aprovada" | "minuta_rejeitada";
  titulo: string;
  mensagem: string;
  created_at: string;
}

function fmtBRL(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtDate(d: string) {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

export default function Dashboard() {
  const { user, roles } = useAuth();
  const isManager = roles.includes("gerente");
  const isStaff = roles.includes("equipe");
  const isVendedor = roles.includes("vendedor");
  const isArtista = roles.includes("artista");
  const isFinanceiro = roles.includes("financeiro");

  const [shows, setShows] = useState<ShowLite[]>([]);
  const [notifs, setNotifs] = useState<NotificationLite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const calls: Promise<any>[] = [
        supabase.functions.invoke("shows-admin", { body: { action: "list" } }),
      ];
      if (isVendedor) {
        calls.push(supabase.functions.invoke("notifications", { body: { action: "list" } }));
      }
      const results = await Promise.all(calls);
      setShows((results[0]?.data?.shows ?? []) as ShowLite[]);
      if (isVendedor) setNotifs((results[1]?.data?.notifications ?? []) as NotificationLite[]);
      setLoading(false);
    })();
  }, [isVendedor]);

  // ===== FINANCEIRO =====
  if (isFinanceiro && !isManager && !isStaff) {
    const aguardando = shows.filter((s) => s.status === "aguardando_pagamento");
    const comprovEnv = shows.filter((s) => s.status === "comprovante_enviado");
    const confirmados = shows.filter((s) => s.status === "confirmado");
    const cancelados = shows.filter((s) => s.status === "cancelado");
    const totalConfirmado = confirmados.reduce((a, s) => a + Number(s.cache_total ?? 0), 0);
    const totalAReceber = [...aguardando, ...comprovEnv].reduce((a, s) => a + Number(s.cache_total ?? 0), 0);

    return (
      <div className="p-6 md:p-8 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-semibold">Olá{user?.email ? `, ${user.email.split("@")[0]}` : ""}</h1>
          <p className="text-muted-foreground mt-1">Painel financeiro.</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard label="Aguardando pagamento" value={aguardando.length.toString()} icon={Clock} tone="amber" />
          <StatCard label="Comprov. p/ confirmar" value={comprovEnv.length.toString()} icon={FileText} tone="orange" />
          <StatCard label="Confirmados" value={confirmados.length.toString()} icon={CheckCircle2} tone="green" />
          <StatCard label="Cancelados" value={cancelados.length.toString()} icon={XCircle} tone="red" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
          <StatCard label="Total a receber" value={fmtBRL(totalAReceber)} icon={Wallet} tone="amber" />
          <StatCard label="Total confirmado" value={fmtBRL(totalConfirmado)} icon={Wallet} tone="green" />
        </div>

        <Card className="p-6 shadow-soft mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Comprovantes para confirmar</h2>
            <Link to="/shows" className="text-sm text-accent hover:underline">Ver todos</Link>
          </div>
          {comprovEnv.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum comprovante aguardando.</p>
          ) : (
            <ul className="divide-y">
              {comprovEnv.slice(0, 8).map((s) => (
                <li key={s.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{s.artist_nome ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{fmtDate(s.data_show)} · {fmtBRL(Number(s.cache_total ?? 0))}</p>
                  </div>
                  <Badge className="bg-orange-500 hover:bg-orange-500 text-white">Confirmar</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-6 shadow-soft">
          <h2 className="text-lg font-semibold mb-4">Aguardando pagamento</h2>
          {aguardando.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum show aguardando.</p>
          ) : (
            <ul className="divide-y">
              {aguardando.slice(0, 8).map((s) => (
                <li key={s.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{s.artist_nome ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmtDate(s.data_show)} · {fmtBRL(Number(s.cache_total ?? 0))}
                      {s.prazo_comprovante_em ? ` · prazo ${new Date(s.prazo_comprovante_em).toLocaleString("pt-BR")}` : ""}
                    </p>
                  </div>
                  <Badge className="bg-amber-500 hover:bg-amber-500 text-white">Aguardando</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    );
  }

  // ===== VENDEDOR =====
  if (isVendedor && !isManager && !isStaff) {
    const pend = shows.filter((s) => s.status === "pendente").length;
    const aprov = shows.filter((s) => s.status === "aprovada").length;
    const rejeitadas30d = notifs.filter(
      (n) => n.tipo === "minuta_rejeitada" &&
        new Date(n.created_at).getTime() > Date.now() - 30 * 24 * 3600 * 1000,
    ).length;

    return (
      <div className="p-6 md:p-8 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-semibold">Olá{user?.email ? `, ${user.email.split("@")[0]}` : ""}</h1>
          <p className="text-muted-foreground mt-1">Painel do vendedor.</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard label="Minhas minutas" value={shows.length.toString()} icon={FileText} />
          <StatCard label="Pendentes" value={pend.toString()} icon={Clock} tone="amber" />
          <StatCard label="Aprovadas" value={aprov.toString()} icon={CheckCircle2} tone="green" />
          <StatCard label="Rejeitadas (30d)" value={rejeitadas30d.toString()} icon={XCircle} tone="red" />
        </div>

        <Card className="p-6 shadow-soft">
          <h2 className="text-lg font-semibold mb-4">Últimas minutas</h2>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : shows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma minuta criada ainda. <Link to="/shows" className="text-accent underline">Criar a primeira</Link>.</p>
          ) : (
            <ul className="divide-y">
              {shows.slice(0, 8).map((s) => (
                <li key={s.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{s.artist_nome ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmtDate(s.data_show)} {s.local ? `· ${s.local}` : ""}{s.cidade ? ` — ${s.cidade}` : ""}
                    </p>
                  </div>
                  {s.status === "aprovada" ? (
                    <Badge className="bg-green-600 hover:bg-green-600 text-white">Aprovada</Badge>
                  ) : (
                    <Badge variant="secondary">Pendente</Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    );
  }

  // ===== ARTISTA =====
  if (isArtista && !isManager && !isStaff) {
    const cacheTotal = shows.reduce((acc, s) => acc + Number(s.cache_total ?? 0), 0);
    const proximos = shows.filter((s) => s.data_show >= new Date().toISOString().slice(0, 10));

    return (
      <div className="p-6 md:p-8 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-semibold">Olá{user?.email ? `, ${user.email.split("@")[0]}` : ""}</h1>
          <p className="text-muted-foreground mt-1">Seu painel financeiro.</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard label="Cachê total previsto" value={fmtBRL(cacheTotal)} icon={Wallet} />
          <StatCard label="Recebido" value="R$ —" icon={Wallet} hint="Em breve" />
          <StatCard label="A receber" value="R$ —" icon={Wallet} hint="Em breve" />
          <StatCard label="Próximos shows" value={proximos.length.toString()} icon={CalendarDays} />
        </div>

        <Card className="p-6 shadow-soft">
          <h2 className="text-lg font-semibold mb-4">Seus próximos shows</h2>
          {proximos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum show futuro cadastrado.</p>
          ) : (
            <ul className="divide-y">
              {proximos.slice(0, 8).map((s) => (
                <li key={s.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{fmtDate(s.data_show)}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.local ?? "Local —"}{s.cidade ? ` — ${s.cidade}` : ""}
                    </p>
                  </div>
                  <span className="text-sm font-medium">{fmtBRL(Number(s.cache_total ?? 0))}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    );
  }

  // ===== GERÊNCIA / EQUIPE =====
  const pendentes = shows.filter((s) => s.status === "pendente");
  const proximos = shows.filter((s) => s.data_show >= new Date().toISOString().slice(0, 10)).length;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-semibold">Olá{user?.email ? `, ${user.email.split("@")[0]}` : ""}</h1>
        <p className="text-muted-foreground mt-1">Visão geral da produtora.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Minutas pendentes" value={pendentes.length.toString()} icon={Clock} tone="amber" />
        <StatCard label="Total de minutas" value={shows.length.toString()} icon={FileText} />
        <StatCard label="Próximos shows" value={proximos.toString()} icon={CalendarDays} />
        <StatCard label="Receita confirmada" value={fmtBRL(shows.filter((s) => s.status === "aprovada").reduce((a, s) => a + Number(s.cache_total ?? 0), 0))} icon={Wallet} tone="green" />
      </div>

      {pendentes.length > 0 && isManager && (
        <Card className="p-6 shadow-soft mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Minutas aguardando aprovação</h2>
            <Link to="/shows" className="text-sm text-accent hover:underline">Ver todas</Link>
          </div>
          <ul className="divide-y">
            {pendentes.slice(0, 5).map((s) => (
              <li key={s.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">{s.artist_nome ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">{fmtDate(s.data_show)} · {fmtBRL(Number(s.cache_total ?? 0))}</p>
                </div>
                <Badge variant="secondary">Pendente</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="p-6 shadow-soft">
        <div className="flex items-center gap-3 mb-3">
          <Music2 className="h-5 w-5 text-accent" />
          <h2 className="text-lg font-semibold">Atalhos</h2>
        </div>
        {isManager ? (
          <Link to="/artistas" className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:opacity-90 transition">
            <Users className="h-4 w-4" />
            Gerenciar artistas
          </Link>
        ) : (
          <p className="text-sm text-muted-foreground">Use o menu lateral para acessar shows e financeiro.</p>
        )}
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  tone,
}: {
  label: string;
  value: string;
  icon: any;
  hint?: string;
  tone?: "amber" | "green" | "red" | "orange";
}) {
  const toneCls =
    tone === "amber"  ? "bg-amber-500/10 text-amber-600" :
    tone === "green"  ? "bg-green-500/10 text-green-600" :
    tone === "red"    ? "bg-destructive/10 text-destructive" :
    tone === "orange" ? "bg-orange-500/10 text-orange-600" :
                        "bg-accent/10 text-accent";
  return (
    <Card className="p-5 shadow-soft">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold mt-2">{value}</p>
          {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
        </div>
        <div className={`h-9 w-9 rounded-md flex items-center justify-center ${toneCls}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </Card>
  );
}
