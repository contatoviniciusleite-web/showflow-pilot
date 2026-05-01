import { useAuth } from "@/contexts/AuthContext";
import { useEffectiveRoles } from "@/contexts/ManagerModeContext";
import { VendedorDashboard } from "@/components/dashboard/VendedorDashboard";
import { ArtistaDashboard } from "@/components/dashboard/ArtistaDashboard";
import { GerenciaDashboard } from "@/components/dashboard/GerenciaDashboard";

export default function Dashboard() {
  // Usa "effective roles" para que o gerente em Modo Vendedor veja o dashboard de vendedor.
  const roles = useEffectiveRoles();
  const { roles: realRoles } = useAuth();

  if (roles.includes("gerente") || roles.includes("equipe") || roles.includes("financeiro")) {
    return <GerenciaDashboard />;
  }
  if (roles.includes("artista")) {
    return <ArtistaDashboard />;
  }
  if (roles.includes("vendedor")) {
    return <VendedorDashboard />;
  }

  // Fallback: usuário sem papel atribuído. Usa realRoles para evitar tela vazia em casos extremos.
  void realRoles;
  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold">Bem-vindo</h1>
      <p className="text-muted-foreground mt-2">Seu acesso ainda não foi configurado. Procure o gerente.</p>
    </div>
  );
}
