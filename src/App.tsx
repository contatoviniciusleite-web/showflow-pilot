import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Route, Routes, useNavigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ManagerModeProvider } from "@/contexts/ManagerModeContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import { Loader2 } from "lucide-react";

// Auth e fluxos públicos ficam eager (carregam rápido e são rota inicial frequente)
import Auth from "./pages/Auth";
import AceitarConvite from "./pages/AceitarConvite";
import NotFound from "./pages/NotFound";

// Demais páginas via code-splitting — cada rota carrega só quando acessada
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Artistas = lazy(() => import("./pages/Artistas"));
const Usuarios = lazy(() => import("./pages/Usuarios"));
const Shows = lazy(() => import("./pages/Shows"));
const Bloqueios = lazy(() => import("./pages/Bloqueios"));
const AgendaPage = lazy(() => import("./pages/Agenda"));
const Contratantes = lazy(() => import("./pages/Contratantes"));
const Financeiro = lazy(() => import("./pages/Financeiro"));
const Relatorios = lazy(() => import("./pages/Relatorios"));
const Diretoria = lazy(() => import("./pages/Diretoria"));
const ContratanteMinuta = lazy(() => import("./pages/ContratanteMinuta"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Dados considerados "frescos" por 30s — evita refetches duplicados ao trocar de aba/foco
      staleTime: 30_000,
      // Mantém em cache 5 min após sair da tela (volta instantâneo)
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function PageFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function InviteHashRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    const hash = window.location.hash;
    if (hash && /type=(invite|recovery)/.test(hash) && window.location.pathname !== "/aceitar-convite") {
      navigate(`/aceitar-convite${hash}`, { replace: true });
    }
  }, [navigate]);

  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ManagerModeProvider>
            <InviteHashRedirect />
            <Suspense fallback={<PageFallback />}>
              <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route path="/aceitar-convite" element={<AceitarConvite />} />
                <Route path="/minuta/:token" element={<ContratanteMinuta />} />
                <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/shows" element={<Shows />} />
                  <Route path="/agenda" element={<AgendaPage />} />
                  <Route
                    path="/financeiro"
                    element={
                      <ProtectedRoute requireRoles={["gerente", "financeiro", "equipe", "diretor"]}>
                        <Financeiro />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/contratantes"
                    element={
                      <ProtectedRoute requireRoles={["gerente", "equipe", "vendedor", "financeiro", "diretor"]}>
                        <Contratantes />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/diretoria"
                    element={
                      <ProtectedRoute requireRoles={["diretor"]}>
                        <Diretoria />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/relatorios"
                    element={
                      <ProtectedRoute requireRoles={["gerente", "financeiro", "vendedor", "diretor"]}>
                        <Relatorios />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/artistas"
                    element={
                      <ProtectedRoute requireRoles={["gerente", "diretor"]}>
                        <Artistas />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/bloqueios"
                    element={
                      <ProtectedRoute requireRoles={["gerente", "diretor"]}>
                        <Bloqueios />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/usuarios"
                    element={
                      <ProtectedRoute requireRoles={["gerente", "diretor"]}>
                        <Usuarios />
                      </ProtectedRoute>
                    }
                  />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ManagerModeProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
