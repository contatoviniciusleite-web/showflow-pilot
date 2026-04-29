import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Artistas from "./pages/Artistas";
import Placeholder from "./pages/Placeholder";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/shows" element={<Placeholder title="Shows" description="Listagem e cadastro de minutas." />} />
              <Route path="/agenda" element={<Placeholder title="Agenda" description="Calendário unificado dos artistas." />} />
              <Route path="/financeiro" element={<Placeholder title="Financeiro" description="Ficha financeira e despesas por show." />} />
              <Route
                path="/relatorios"
                element={
                  <ProtectedRoute requireRoles={["gerente"]}>
                    <Placeholder title="Relatórios" description="Relatórios por artista e período." />
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
                path="/usuarios"
                element={
                  <ProtectedRoute requireRoles={["gerente"]}>
                    <Placeholder title="Usuários" description="Gestão de papéis e vínculos." />
                  </ProtectedRoute>
                }
              />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
