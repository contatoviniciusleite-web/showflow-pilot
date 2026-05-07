import { useEffect } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Calendar, LayoutDashboard, Users, Music2, DollarSign, FileText, LogOut, ListMusic, Ban, Building2, Crown, FileSpreadsheet, Wallet, Truck, Briefcase, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEffectiveRoles } from "@/contexts/ManagerModeContext";
import { ManagerModeToggle } from "@/components/ManagerModeToggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/NotificationBell";
import { useProfile } from "@/hooks/useProfile";
import { User as UserIcon } from "lucide-react";

// Prefetch dos chunks lazy: dispara o import() ao passar o mouse,
// fazendo a próxima rota abrir instantaneamente.
const prefetchers: Record<string, () => Promise<unknown>> = {
  "/app": () => import("@/pages/Dashboard"),
  "/agenda": () => import("@/pages/Agenda"),
  "/shows": () => import("@/pages/Shows"),
  "/financeiro": () => import("@/pages/Financeiro"),
  "/contratantes": () => import("@/pages/Contratantes"),
  "/diretoria": () => import("@/pages/Diretoria"),
  "/relatorios": () => import("@/pages/Relatorios"),
  "/artistas": () => import("@/pages/Artistas"),
  "/bloqueios": () => import("@/pages/Bloqueios"),
  "/usuarios": () => import("@/pages/Usuarios"),
  "/fechamento": () => import("@/pages/Fechamento"),
};
const prefetched = new Set<string>();
function prefetchRoute(path: string) {
  if (prefetched.has(path)) return;
  prefetched.add(path);
  prefetchers[path]?.().catch(() => prefetched.delete(path));
}

const nav = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, roles: ["diretor", "gerente", "equipe", "artista", "vendedor", "financeiro", "socio"] },
  { to: "/agenda", label: "Agenda", icon: Calendar, roles: ["diretor", "gerente", "equipe", "artista", "vendedor", "financeiro", "socio"] },
  { to: "/shows", label: "Shows", icon: ListMusic, roles: ["diretor", "gerente", "equipe", "artista", "vendedor", "financeiro"] },
  { to: "/financeiro", label: "Financeiro", icon: DollarSign, roles: ["diretor", "gerente", "equipe", "artista", "financeiro", "socio"] },
  { to: "/fechamento", label: "Fechamentos", icon: FileSpreadsheet, roles: ["diretor", "financeiro", "artista", "socio"] },
  { to: "/pagamentos", label: "Pagamentos", icon: Wallet, roles: ["diretor", "financeiro"] },
  { to: "/financeiro-produtora", label: "Financeiro da Produtora", icon: Briefcase, roles: ["diretor", "financeiro"] },
  { to: "/fornecedores", label: "Fornecedores", icon: Truck, roles: ["diretor", "financeiro"] },
  { to: "/contratantes", label: "Contratantes", icon: Building2, roles: ["diretor", "gerente", "equipe", "vendedor", "financeiro"] },
  { to: "/diretoria", label: "Diretoria", icon: Crown, roles: ["diretor"] },
  { to: "/relatorios", label: "Relatórios", icon: FileText, roles: ["diretor", "gerente"] },
  { to: "/artistas", label: "Artistas", icon: Music2, roles: ["diretor", "gerente"] },
  { to: "/bloqueios", label: "Bloqueios", icon: Ban, roles: ["diretor", "gerente"] },
  { to: "/usuarios", label: "Usuários", icon: Users, roles: ["diretor", "gerente", "financeiro"] },
  { to: "/admin/whatsapp-test", label: "WhatsApp (teste)", icon: MessageCircle, roles: ["diretor"] },
] as const;

export function AppLayout() {
  const { user, roles, signOut } = useAuth();
  const { displayName } = useProfile();
  const effectiveRoles = useEffectiveRoles();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const visible = nav.filter((n) => n.roles.some((r) => effectiveRoles.includes(r)));

  // Prefetch de dados ao passar o mouse — abre tela instantaneamente.
  const prefetchData = (to: string) => {
    if (to === "/shows") {
      queryClient.prefetchQuery({
        queryKey: ["shows", user?.id, roles.join(","), "bootstrap-v1"],
        queryFn: async () => {
          const res = await supabase.functions.invoke("shows-admin", { body: { action: "bootstrap" } });
          if (res.error) throw new Error(res.error.message);
          return {
            shows: res.data?.shows ?? [],
            outras: res.data?.outras_aprovadas ?? [],
            artists: res.data?.artists ?? [],
          };
        },
      });
    } else if (to === "/financeiro") {
      queryClient.prefetchQuery({
        queryKey: ["financeiro"],
        queryFn: async () => {
          const r = await supabase.functions.invoke("shows-admin", { body: { action: "finance_summary" } });
          return r.data?.shows ?? [];
        },
      });
    } else if (to === "/app") {
      queryClient.prefetchQuery({
        queryKey: ["dashboard"],
        queryFn: async () => {
          const r = await supabase.functions.invoke("shows-admin", { body: { action: "list" } });
          return r.data?.shows ?? [];
        },
      });
    }
  };
  const onHover = (to: string) => { prefetchRoute(to); prefetchData(to); };

  // Keep-alive: ping a cada 2 minutos para evitar cold start na Edge Function.
  // Pausa quando a aba está em background para não consumir recursos à toa.
  useEffect(() => {
    if (!user) return;
    let interval: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (interval) return;
      interval = setInterval(() => {
        supabase.functions.invoke("shows-admin", { body: { action: "ping" } }).catch(() => {});
      }, 2 * 60 * 1000);
    };
    const stop = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };
    const onVisibility = () => {
      if (document.hidden) stop(); else start();
    };
    // Ping imediato ao logar
    supabase.functions.invoke("shows-admin", { body: { action: "ping" } }).catch(() => {});
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [user]);

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden md:flex w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <div className="px-6 py-6 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-accent flex items-center justify-center">
              <Music2 className="h-4 w-4 text-accent-foreground" />
            </div>
            <div>
              <h1 className="text-base font-semibold leading-tight">Stage</h1>
              <p className="text-xs text-sidebar-foreground/60">Piloto MVP</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {visible.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/app"}
              onMouseEnter={() => onHover(item.to)}
              onFocus={() => onHover(item.to)}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <div className="px-3 py-2 mb-2">
            <p className="text-xs text-sidebar-foreground/60">Logado como</p>
            <p className="text-sm font-medium truncate">{displayName}</p>
            <p className="text-xs text-sidebar-foreground/60 truncate">{user?.email}</p>
            <p className="text-xs text-accent capitalize">{roles.join(", ") || "sem papel"}</p>
          </div>
          <NavLink
            to="/perfil"
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              )
            }
          >
            <UserIcon className="h-4 w-4" />
            Meu perfil
          </NavLink>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
            onClick={async () => {
              await signOut();
              navigate("/auth");
            }}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-30 bg-sidebar text-sidebar-foreground border-b border-sidebar-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-gradient-accent flex items-center justify-center">
            <Music2 className="h-3.5 w-3.5 text-accent-foreground" />
          </div>
          <span className="font-semibold">Stage</span>
        </div>
        <div className="flex items-center gap-1">
          <ManagerModeToggle compact />
          <NotificationBell />
          <Button variant="ghost" size="sm" onClick={async () => { await signOut(); navigate("/auth"); }}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <main className="flex-1 md:pt-0 pt-14 pb-20 md:pb-0">
        <div className="hidden md:flex items-center justify-between gap-2 px-6 py-3 border-b">
          <ManagerModeToggle />
          <NotificationBell />
        </div>
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-sidebar text-sidebar-foreground border-t border-sidebar-border flex gap-1 overflow-x-auto px-2 py-2">
        {visible.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/app"}
            onTouchStart={() => onHover(item.to)}
            className={({ isActive }) =>
              cn(
                "flex min-w-16 flex-1 flex-col items-center gap-0.5 px-2 py-1 text-[10px] font-medium",
                isActive ? "text-accent" : "text-sidebar-foreground/70"
              )
            }
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
