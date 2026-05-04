import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Calendar,
  DollarSign,
  GitBranch,
  ShieldCheck,
  FileText,
  BellRing,
  Lock,
  CalendarClock,
  FileSignature,
  Activity,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

/* ----------------------------- Brand mark ----------------------------- */
function StageMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <div
      className={`flex items-center justify-center rounded-xl ${className}`}
      style={{ background: "hsl(var(--stage-green))" }}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4 text-white" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        <path d="M3 12h2" />
        <path d="M7 8v8" />
        <path d="M11 5v14" />
        <path d="M15 8v8" />
        <path d="M19 12h2" />
      </svg>
    </div>
  );
}

function Wordmark({ light = false }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <StageMark />
      <div className="leading-tight">
        <div className={`text-base font-semibold tracking-tight ${light ? "text-white" : ""}`}>
          Stage<span style={{ color: "hsl(var(--stage-green))" }}>.</span>
        </div>
        <div className={`hidden text-[11px] sm:block ${light ? "text-white/60" : "text-muted-foreground"}`}>
          Gestão para produtoras
        </div>
      </div>
    </div>
  );
}

/* --------------------------- Particle network -------------------------- */
function ParticleNetwork() {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let w = 0, h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    type P = { x: number; y: number; vx: number; vy: number };
    let pts: P[] = [];

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      w = r.width; h = r.height;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(70, Math.floor((w * h) / 16000));
      pts = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
      }));
    };
    resize();
    window.addEventListener("resize", resize);

    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of pts) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
      }
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x;
          const dy = pts[i].y - pts[j].y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 130 * 130) {
            const a = 1 - Math.sqrt(d2) / 130;
            ctx.strokeStyle = `rgba(0, 200, 83, ${a * 0.35})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.stroke();
          }
        }
      }
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      for (const p of pts) {
        ctx.beginPath(); ctx.arc(p.x, p.y, 1.4, 0, Math.PI * 2); ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={ref} className="absolute inset-0 h-full w-full" aria-hidden />;
}

/* ----------------------------- Counter --------------------------------- */
function Counter({ to, suffix = "", duration = 1400 }: { to: number; suffix?: string; duration?: number }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement | null>(null);
  const started = useRef(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting && !started.current) {
          started.current = true;
          const t0 = performance.now();
          const step = (t: number) => {
            const p = Math.min(1, (t - t0) / duration);
            const eased = 1 - Math.pow(1 - p, 3);
            setVal(Math.round(to * eased));
            if (p < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }
      });
    }, { threshold: 0.4 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [to, duration]);
  return <span ref={ref}>{val}{suffix}</span>;
}

/* ----------------------------- Reveal ---------------------------------- */
function useRevealOnScroll() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>(".stage-reveal");
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("is-visible"); });
    }, { threshold: 0.15 });
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);
}

/* ----------------------------- Mockups --------------------------------- */
function MockupBrowser({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#101010] p-3 shadow-2xl">
      <div className="mb-3 flex items-center gap-1.5">
        <div className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
        <div className="h-2.5 w-2.5 rounded-full bg-yellow-400/80" />
        <div className="h-2.5 w-2.5 rounded-full" style={{ background: "hsl(var(--stage-green))" }} />
        <span className="ml-3 text-[11px] text-white/40">stage / {label}</span>
      </div>
      <div className="rounded-lg bg-white p-4">{children}</div>
    </div>
  );
}

function ShowsMockup() {
  return (
    <div className="space-y-2">
      {["Aprovado", "Aguardando sinal", "Confirmado", "Em minuta"].map((s, i) => (
        <div key={i} className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-2">
          <div>
            <div className="text-xs font-medium text-zinc-800">Show #{2025 - i}</div>
            <div className="text-[10px] text-zinc-500">12/0{i + 3}/2026</div>
          </div>
          <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: "hsl(var(--stage-green) / 0.12)", color: "hsl(var(--stage-green-deep))" }}>{s}</span>
        </div>
      ))}
    </div>
  );
}
function FinanceMockup() {
  const bars = [40, 70, 55, 90, 65, 85];
  return (
    <div>
      <div className="mb-2 text-xs text-zinc-500">Cachês confirmados</div>
      <div className="flex h-24 items-end gap-2">
        {bars.map((b, i) => (
          <div key={i} className="flex-1 rounded-t" style={{ height: `${b}%`, background: "hsl(var(--stage-green))" }} />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-zinc-400">
        {["Jan","Fev","Mar","Abr","Mai","Jun"].map(m=> <span key={m}>{m}</span>)}
      </div>
    </div>
  );
}
function AgendaMockup() {
  return (
    <div className="grid grid-cols-7 gap-1">
      {Array.from({ length: 28 }).map((_, i) => {
        const active = [3, 7, 12, 18, 22].includes(i);
        return (
          <div key={i} className={`flex h-8 items-center justify-center rounded text-[10px] ${active ? "text-white" : "text-zinc-500 bg-zinc-100"}`} style={active ? { background: "hsl(var(--stage-green))" } : undefined}>
            {i + 1}
          </div>
        );
      })}
    </div>
  );
}

/* ============================== Page =================================== */
export default function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate("/app", { replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useRevealOnScroll();

  const green = "hsl(var(--stage-green))";

  const solucoes = [
    { icon: GitBranch, title: "Gestão de Shows", desc: "Do cadastro da minuta à aprovação final. Fluxo completo com rastreabilidade, travas automáticas e notificações em tempo real.", mockup: <ShowsMockup />, label: "shows" },
    { icon: DollarSign, title: "Controle Financeiro", desc: "Cachês, depósitos, comprovantes e confirmações. Tudo registrado, auditável e visível para quem precisa ver.", mockup: <FinanceMockup />, label: "financeiro" },
    { icon: Calendar, title: "Agenda Inteligente", desc: "Calendário unificado de todos os artistas. Conflitos identificados automaticamente. Status visual em tempo real.", mockup: <AgendaMockup />, label: "agenda" },
  ];

  const features = [
    { icon: FileText, title: "Minuta Digital", desc: "Crie minutas em segundos com apenas 5 campos. Contratante preenche pelo celular via link." },
    { icon: GitBranch, title: "Aprovação com rastreio", desc: "Cada minuta tem fluxo de aprovação com histórico completo. Nada passa sem registro." },
    { icon: BellRing, title: "Alertas automáticos", desc: "Pagamentos vencidos, comprovantes pendentes e shows a confirmar. Avisamos antes do problema." },
    { icon: Lock, title: "Controle de acesso", desc: "Cada pessoa vê apenas o que precisa. Cinco perfis com dashboards próprios." },
    { icon: CalendarClock, title: "Agenda em tempo real", desc: "Google Calendar integrado. Shows atualizados em todos os dispositivos da equipe." },
    { icon: FileSignature, title: "Gestão de contratos", desc: "Gere contratos em PDF a partir da minuta. Controle status de envio e assinatura." },
  ];

  const perfis = [
    { name: "Diretor", tagline: "Visão completa do negócio", perms: ["Aprovar minutas", "Ver financeiro consolidado", "Gerenciar usuários", "Relatórios estratégicos"] },
    { name: "Gerente", tagline: "Operação no controle", perms: ["Gerenciar shows", "Acompanhar prazos", "Cadastrar artistas", "Configurar bloqueios"] },
    { name: "Financeiro", tagline: "Caixa sob controle", perms: ["Confirmar depósitos", "Validar comprovantes", "Conciliar cachês", "Exportar relatórios"] },
    { name: "Vendedor", tagline: "Foco no contratante", perms: ["Criar minutas", "Negociar valores", "Acompanhar status", "Histórico do cliente"] },
    { name: "Artista", tagline: "Sua agenda na mão", perms: ["Ver próximos shows", "Confirmar disponibilidade", "Acessar contratos", "Receber notificações"] },
  ];

  const etapas = [
    "Vendedor cria a minuta",
    "Diretor aprova",
    "Contratante preenche os dados",
    "Sinal é pago e confirmado",
    "Show confirmado na agenda",
  ];

  return (
    <div className="min-h-screen bg-white text-[#1a1a1a]">
      {/* HEADER */}
      <header
        className={`fixed top-0 z-50 w-full transition-all duration-300 ${
          scrolled ? "bg-white/95 shadow-sm backdrop-blur" : "bg-transparent"
        }`}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link to="/" aria-label="Stage — início">
            <Wordmark light={!scrolled} />
          </Link>
          <nav className="hidden items-center gap-8 text-sm md:flex">
            {[
              ["Soluções", "#solucoes"],
              ["Funcionalidades", "#funcionalidades"],
              ["Perfis", "#perfis"],
              ["Contato", "#contato"],
            ].map(([label, href]) => (
              <a
                key={href}
                href={href}
                className={`transition-colors ${scrolled ? "text-zinc-700 hover:text-[#1a1a1a]" : "text-white/80 hover:text-white"}`}
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="outline"
              size="sm"
              className={scrolled
                ? "border-[#1a1a1a]/15 bg-transparent text-[#1a1a1a] hover:bg-zinc-100"
                : "border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white"}
            >
              <Link to="/auth">Fazer Login</Link>
            </Button>
            <Button asChild size="sm" className="text-white hover:opacity-90" style={{ background: green }}>
              <Link to="/auth">Portal da Produtora</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden bg-[#1a1a1a] text-white">
        <div className="absolute inset-0">
          <ParticleNetwork />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#1a1a1a]" />
        </div>
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-32 md:grid-cols-2 md:pb-28 md:pt-40">
          <div style={{ animation: "stage-float-up .9s ease both" }}>
            <span
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/80 backdrop-blur"
            >
              <Sparkles className="h-3.5 w-3.5" style={{ color: green }} />
              Novo — Gestão completa para produtoras
            </span>
            <h1 className="mt-6 text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">
              Sua produtora no
              <br />
              <span style={{ color: green }}>próximo nível</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-white/70">
              Do primeiro contato ao show confirmado. Gerencie artistas, shows, contratos e financeiro em uma única plataforma.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="text-white hover:opacity-90" style={{ background: green }}>
                <Link to="/auth">Portal da Produtora</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white">
                <Link to="/auth">Fazer Login</Link>
              </Button>
            </div>
            <a href="#numeros" className="mt-12 inline-flex items-center gap-2 text-xs text-white/50 hover:text-white/80">
              <ChevronDown className="h-4 w-4" style={{ animation: "stage-scroll-bounce 1.6s ease-in-out infinite" }} />
              Role para descobrir
            </a>
          </div>

          <div style={{ animation: "stage-float-up 1.1s ease .15s both" }}>
            <MockupBrowser label="dashboard">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 rounded-md p-3" style={{ background: "hsl(var(--stage-green) / 0.08)" }}>
                  <div className="text-[10px] uppercase tracking-wide text-zinc-500">Próximos shows</div>
                  <div className="mt-2 text-2xl font-semibold text-zinc-900">12</div>
                </div>
                <div className="rounded-md bg-zinc-100 p-3">
                  <div className="text-[10px] uppercase tracking-wide text-zinc-500">Pendentes</div>
                  <div className="mt-2 text-2xl font-semibold text-zinc-900">3</div>
                </div>
              </div>
              <div className="mt-3"><ShowsMockup /></div>
            </MockupBrowser>
          </div>
        </div>
      </section>

      {/* NÚMEROS */}
      <section id="numeros" className="border-b border-zinc-100 bg-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:grid-cols-2 md:grid-cols-4 md:py-20">
          {[
            { n: 6, suffix: "", label: "Artistas gerenciados" },
            { n: 100, suffix: "%", label: "Digital — zero planilha" },
            { n: 5, suffix: "", label: "Perfis de acesso" },
            { n: 48, suffix: "h", label: "Prazo automático de confirmação" },
          ].map((m) => (
            <div key={m.label} className="text-center stage-reveal">
              <div className="text-5xl font-bold tracking-tight" style={{ color: green }}>
                <Counter to={m.n} suffix={m.suffix} />
              </div>
              <div className="mt-2 text-sm text-zinc-600">{m.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* SOLUÇÕES */}
      <section id="solucoes" className="bg-zinc-50">
        <div className="mx-auto max-w-6xl px-4 py-20 md:py-28">
          <div className="mx-auto max-w-2xl text-center stage-reveal">
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: green }}>Soluções</span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Uma plataforma, múltiplas soluções</h2>
            <p className="mt-4 text-zinc-600">Tudo o que sua operação precisa, integrado em um só lugar.</p>
          </div>
          <div className="mt-14 grid gap-8 md:grid-cols-3">
            {solucoes.map((s) => (
              <div key={s.title} className="stage-reveal rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-xl">
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg" style={{ background: "hsl(var(--stage-green) / 0.12)", color: "hsl(var(--stage-green-deep))" }}>
                  <s.icon className="h-5 w-5" />
                </div>
                <h3 className="text-xl font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-zinc-600">{s.desc}</p>
                <div className="mt-6"><MockupBrowser label={s.label}>{s.mockup}</MockupBrowser></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FUNCIONALIDADES */}
      <section id="funcionalidades" className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-20 md:py-28">
          <div className="mx-auto max-w-2xl text-center stage-reveal">
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: green }}>Funcionalidades</span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Tudo que sua produtora precisa</h2>
          </div>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="stage-reveal group rounded-xl border border-zinc-200 bg-white p-6 transition-all hover:-translate-y-1 hover:border-[hsl(var(--stage-green))] hover:shadow-lg">
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-zinc-100 transition-colors group-hover:bg-[hsl(var(--stage-green)/0.12)]">
                  <f.icon className="h-5 w-5 text-zinc-700 transition-colors group-hover:text-[hsl(var(--stage-green-deep))]" />
                </div>
                <h3 className="text-base font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-zinc-600">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PERFIS */}
      <section id="perfis" className="bg-[#1a1a1a] text-white">
        <div className="mx-auto max-w-6xl px-4 py-20 md:py-28">
          <div className="mx-auto max-w-2xl text-center stage-reveal">
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: green }}>Perfis</span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Para cada função, uma experiência</h2>
            <p className="mt-4 text-white/60">Passe o mouse em cada card para ver as permissões.</p>
          </div>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {perfis.map((p) => (
              <div key={p.name} className="stage-flip stage-reveal h-56" tabIndex={0}>
                <div className="stage-flip-inner h-full">
                  <div className="stage-flip-face h-full rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur">
                    <div className="flex h-full flex-col">
                      <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: "hsl(var(--stage-green) / 0.18)", color: green }}>
                        <ShieldCheck className="h-5 w-5" />
                      </div>
                      <div className="mt-auto">
                        <div className="text-lg font-semibold">{p.name}</div>
                        <div className="mt-1 text-xs text-white/60">{p.tagline}</div>
                      </div>
                    </div>
                  </div>
                  <div className="stage-flip-face stage-flip-back h-full rounded-2xl p-5 text-[#1a1a1a]" style={{ background: green }}>
                    <div className="text-sm font-semibold">{p.name}</div>
                    <ul className="mt-3 space-y-1.5 text-xs">
                      {p.perms.map((x) => (
                        <li key={x} className="flex gap-2"><span>•</span><span>{x}</span></li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-20 md:py-28">
          <div className="mx-auto max-w-2xl text-center stage-reveal">
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: green }}>Como funciona</span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Do contato ao show em 5 etapas</h2>
          </div>
          <div className="mt-14">
            <div className="hidden md:block">
              <div className="relative">
                <div className="absolute left-0 right-0 top-6 h-[2px] bg-zinc-200" />
                <div className="relative grid grid-cols-5 gap-4">
                  {etapas.map((e, i) => (
                    <div key={e} className="stage-reveal text-center" style={{ transitionDelay: `${i * 80}ms` }}>
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full text-sm font-semibold text-white shadow" style={{ background: green }}>
                        {i + 1}
                      </div>
                      <div className="mt-4 text-sm text-zinc-700">{e}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <ol className="space-y-4 md:hidden">
              {etapas.map((e, i) => (
                <li key={e} className="stage-reveal flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white" style={{ background: green }}>{i + 1}</div>
                  <div className="pt-1.5 text-sm text-zinc-700">{e}</div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="contato" style={{ background: green }}>
        <div className="mx-auto max-w-4xl px-4 py-20 text-center md:py-24">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-5xl">
            Pronto para transformar
            <br />sua produtora?
          </h2>
          <p className="mt-4 text-white/85">Acesse agora e veja na prática.</p>
          <div className="mt-8 flex justify-center">
            <Button asChild size="lg" className="bg-white hover:bg-white/90" style={{ color: "hsl(var(--stage-green-deep))" }}>
              <Link to="/auth">Portal da Produtora</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#1a1a1a] text-white/70">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-10 text-sm sm:flex-row">
          <Wordmark light />
          <div className="flex items-center gap-6">
            <Link to="/auth" className="hover:text-white">Fazer Login</Link>
            <Link to="/auth" className="hover:text-white">Portal da Produtora</Link>
          </div>
          <div className="flex items-center gap-2 text-xs text-white/50">
            <Activity className="h-3.5 w-3.5" style={{ color: green }} />
            © {new Date().getFullYear()} Stage — Todos os direitos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
}
