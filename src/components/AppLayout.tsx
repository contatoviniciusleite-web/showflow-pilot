import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Calendar, LayoutDashboard, Users, Music2, DollarSign, FileText, LogOut, ListMusic } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/NotificationBell";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["gerente", "equipe", "artista", "vendedor", "financeiro"] },
  { to: "/shows", label: "Shows", icon: ListMusic, roles: ["gerente", "equipe", "artista", "vendedor", "financeiro"] },
  { to: "/agenda", label: "Agenda", icon: Calendar, roles: ["gerente", "equipe", "artista"] },
  { to: "/financeiro", label: "Financeiro", icon: DollarSign, roles: ["gerente", "equipe", "artista", "financeiro"] },
  { to: "/relatorios", label: "Relatórios", icon: FileText, roles: ["gerente"] },
  { to: "/artistas", label: "Artistas", icon: Music2, roles: ["gerente"] },
  { to: "/usuarios", label: "Usuários", icon: Users, roles: ["gerente"] },
] as const;

export function AppLayout() {
  const { user, roles, signOut } = useAuth();
  const navigate = useNavigate();

  const visible = nav.filter((n) => n.roles.some((r) => roles.includes(r)));

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
              end={item.to === "/"}
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
            <p className="text-sm truncate">{user?.email}</p>
            <p className="text-xs text-accent capitalize">{roles.join(", ") || "sem papel"}</p>
          </div>
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
          <NotificationBell />
          <Button variant="ghost" size="sm" onClick={async () => { await signOut(); navigate("/auth"); }}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <main className="flex-1 md:pt-0 pt-14 pb-20 md:pb-0">
        <div className="hidden md:flex items-center justify-end gap-2 px-6 py-3 border-b">
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
            end={item.to === "/"}
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
