import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Music2, Calendar, DollarSign, GitBranch, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

export default function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate("/app", { replace: true });
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600">
              <Music2 className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <div className="text-base font-semibold">Stage</div>
              <div className="hidden text-xs text-muted-foreground sm:block">Gestão para produtoras musicais</div>
            </div>
          </Link>
          <Button asChild className="bg-emerald-600 text-white hover:bg-emerald-700">
            <Link to="/auth">Fazer Login</Link>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 md:grid-cols-2 md:py-24">
          <div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              Gerencie sua produtora com{" "}
              <span className="text-emerald-600">inteligência</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              Da minuta ao show confirmado, tudo em um só lugar. Agenda, financeiro,
              contratos e equipe integrados.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="bg-emerald-600 text-white hover:bg-emerald-700">
                <Link to="/auth">Fazer Login</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-emerald-600 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-700"
              >
                <Link to="/minuta/exemplo">Portal do Contratante</Link>
              </Button>
            </div>
          </div>

          {/* Mockup ilustrativo */}
          <div className="relative">
            <div className="absolute -inset-4 rounded-3xl bg-emerald-100/60 blur-2xl" aria-hidden />
            <div className="relative rounded-2xl border border-border bg-card p-5 shadow-elevated">
              <div className="mb-4 flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
                <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <span className="ml-3 text-xs text-muted-foreground">stage / dashboard</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 h-24 rounded-lg bg-gradient-to-br from-emerald-500/15 to-emerald-500/5" />
                <div className="h-24 rounded-lg bg-muted" />
                <div className="h-16 rounded-lg bg-muted" />
                <div className="h-16 rounded-lg bg-emerald-600/10" />
                <div className="h-16 rounded-lg bg-muted" />
              </div>
              <div className="mt-3 space-y-2">
                <div className="h-3 w-3/4 rounded bg-muted" />
                <div className="h-3 w-1/2 rounded bg-muted" />
                <div className="h-3 w-2/3 rounded bg-muted" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border bg-secondary/30">
        <div className="mx-auto max-w-6xl px-4 py-16 md:py-24">
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
            Tudo que sua produtora precisa
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: Calendar,
                title: "Agenda inteligente",
                desc: "Visualize todos os shows de todos os artistas em um calendário unificado.",
              },
              {
                icon: DollarSign,
                title: "Financeiro completo",
                desc: "Controle cachês, depósitos, comprovantes e confirmações em tempo real.",
              },
              {
                icon: GitBranch,
                title: "Fluxo de aprovação",
                desc: "Da minuta básica à confirmação, com rastreabilidade de cada etapa.",
              },
              {
                icon: ShieldCheck,
                title: "Acesso por perfil",
                desc: "Diretor, gerente, financeiro, vendedor e artista — cada um vê o que precisa.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-border bg-card p-6 shadow-soft transition-shadow hover:shadow-elevated"
              >
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-600/10 text-emerald-700">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-emerald-50">
        <div className="mx-auto max-w-4xl px-4 py-20 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-emerald-950 sm:text-4xl">
            Pronto para organizar sua produtora?
          </h2>
          <div className="mt-8 flex justify-center">
            <Button asChild size="lg" className="bg-emerald-600 text-white hover:bg-emerald-700">
              <Link to="/auth">Fazer Login</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-8 text-sm text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <Music2 className="h-4 w-4 text-emerald-600" />
            <span>Stage — Gestão para produtoras musicais</span>
          </div>
          <div>© {new Date().getFullYear()}</div>
        </div>
      </footer>
    </div>
  );
}
