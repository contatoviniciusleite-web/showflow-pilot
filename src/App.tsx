import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Route, Routes, useNavigate } from "react-router-dom";
import * as Sentry from "@sentry/react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ManagerModeProvider } from "@/contexts/ManagerModeContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Loader2 } from "lucide-react";

// Auth e fluxos públicos ficam eager (carregam rápido e são rota inicial frequente)
import Auth from "./pages/Auth";
import AceitarConvite from "./pages/AceitarConvite";
import NotFound from "./pages/NotFound";
import Landing from "./pages/Landing";

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
const Perfil = lazy(() => import("./pages/Perfil"));
const Fechamento = lazy(() => import("./pages/Fechamento"));
const FechamentoDetalhe = lazy(() => import("./pages/FechamentoDetalhe"));
const Pagamentos = lazy(() => import("./pages/Pagamentos"));
const Fornecedores = lazy(() => import("./pages/Fornecedores"));
const FinanceiroProdutora = lazy(() => import("./pages/FinanceiroProdutora"));
const WhatsappTest = lazy(() => import("./pages/admin/WhatsappTest"));

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

function GlobalErrorFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-md text-center space-y-4">
        <div className="text-5xl" aria-hidden>⚠️</div>
        <h1 className="text-xl font-semibold">Algo deu errado</h1>
        <p className="text-sm text-muted-foreground">
          Nossa equipe foi notificada automaticamente. Tente recarregar a página.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium"
        >
          Recarregar página
        </button>
      </div>
    </div>
  );
}

const App = () => (
  <Sentry.ErrorBoundary fallback={<GlobalErrorFallback />}>
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
                <Route path="/" element={<Landing />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/aceitar-convite" element={<AceitarConvite />} />
                <Route path="/minuta/:token" element={<ContratanteMinuta />} />
                <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                  <Route path="/app" element={<ErrorBoundary label="Dashboard"><Dashboard /></ErrorBoundary>} />
                  <Route path="/shows" element={<ErrorBoundary label="Shows"><Shows /></ErrorBoundary>} />
                  <Route path="/agenda" element={<ErrorBoundary label="Agenda"><AgendaPage /></ErrorBoundary>} />
                  <Route
                    path="/financeiro"
                    element={
                      <ProtectedRoute requireRoles={["gerente", "financeiro", "equipe", "diretor"]}>
                        <ErrorBoundary label="Financeiro"><Financeiro /></ErrorBoundary>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/fechamento"
                    element={
                      <ProtectedRoute requireRoles={["diretor", "financeiro", "artista"]}>
                        <ErrorBoundary label="Fechamento"><Fechamento /></ErrorBoundary>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/fechamento/:id"
                    element={
                      <ProtectedRoute requireRoles={["diretor", "financeiro", "artista"]}>
                        <ErrorBoundary label="FechamentoDetalhe"><FechamentoDetalhe /></ErrorBoundary>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/pagamentos"
                    element={
                      <ProtectedRoute requireRoles={["diretor", "financeiro"]}>
                        <ErrorBoundary label="Pagamentos"><Pagamentos /></ErrorBoundary>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/fornecedores"
                    element={
                      <ProtectedRoute requireRoles={["diretor", "financeiro"]}>
                        <ErrorBoundary label="Fornecedores"><Fornecedores /></ErrorBoundary>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/financeiro-produtora"
                    element={
                      <ProtectedRoute requireRoles={["diretor", "financeiro"]}>
                        <ErrorBoundary label="FinanceiroProdutora"><FinanceiroProdutora /></ErrorBoundary>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    element={
                      <ProtectedRoute requireRoles={["gerente", "equipe", "vendedor", "financeiro", "diretor"]}>
                        <ErrorBoundary label="Contratantes"><Contratantes /></ErrorBoundary>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/diretoria"
                    element={
                      <ProtectedRoute requireRoles={["diretor"]}>
                        <ErrorBoundary label="Diretoria"><Diretoria /></ErrorBoundary>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/relatorios"
                    element={
                      <ProtectedRoute requireRoles={["gerente", "financeiro", "vendedor", "diretor"]}>
                        <ErrorBoundary label="Relatorios"><Relatorios /></ErrorBoundary>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/artistas"
                    element={
                      <ProtectedRoute requireRoles={["gerente", "diretor"]}>
                        <ErrorBoundary label="Artistas"><Artistas /></ErrorBoundary>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/bloqueios"
                    element={
                      <ProtectedRoute requireRoles={["gerente", "diretor"]}>
                        <ErrorBoundary label="Bloqueios"><Bloqueios /></ErrorBoundary>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/usuarios"
                    element={
                      <ProtectedRoute requireRoles={["gerente", "diretor"]}>
                        <ErrorBoundary label="Usuarios"><Usuarios /></ErrorBoundary>
                      </ProtectedRoute>
                    }
                  />
                  <Route path="/perfil" element={<ErrorBoundary label="Perfil"><Perfil /></ErrorBoundary>} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ManagerModeProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </Sentry.ErrorBoundary>
);

export default App;
