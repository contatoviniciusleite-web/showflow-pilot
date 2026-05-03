import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { BrowserRouter, Route, Routes, useNavigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ManagerModeProvider } from "@/contexts/ManagerModeContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import Auth from "./pages/Auth";
import AceitarConvite from "./pages/AceitarConvite";
import Dashboard from "./pages/Dashboard";
import Artistas from "./pages/Artistas";
import Usuarios from "./pages/Usuarios";
import Shows from "./pages/Shows";
import Bloqueios from "./pages/Bloqueios";
import Placeholder from "./pages/Placeholder";
import AgendaPage from "./pages/Agenda";
import Contratantes from "./pages/Contratantes";
import Financeiro from "./pages/Financeiro";
import Relatorios from "./pages/Relatorios";
import ContratanteMinuta from "./pages/ContratanteMinuta";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

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
                  <ProtectedRoute requireRoles={["gerente", "financeiro", "equipe"]}>
                    <Financeiro />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/contratantes"
                element={
                  <ProtectedRoute requireRoles={["gerente", "equipe", "vendedor", "financeiro"]}>
                    <Contratantes />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/relatorios"
                element={
                  <ProtectedRoute requireRoles={["gerente", "financeiro", "vendedor"]}>
                    <Relatorios />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/artistas"
                element={
                  <ProtectedRoute requireRoles={["gerente"]}>
                    <Artistas />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/bloqueios"
                element={
                  <ProtectedRoute requireRoles={["gerente"]}>
                    <Bloqueios />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/usuarios"
                element={
                  <ProtectedRoute requireRoles={["gerente"]}>
                    <Usuarios />
                  </ProtectedRoute>
                }
              />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
          </ManagerModeProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
