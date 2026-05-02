import { useEffectiveRoles } from "@/contexts/ManagerModeContext";
import { VendedorAgenda } from "@/components/dashboard/VendedorAgenda";
import { FinanceiroAgenda } from "@/components/dashboard/FinanceiroAgenda";

export default function AgendaPage() {
  const roles = useEffectiveRoles();
  const isFinanceiro = roles.includes("financeiro");
  const isManager = roles.includes("gerente");
  const isStaff = roles.includes("equipe");
  const isVendedor = roles.includes("vendedor");

  // Visão completa para Gerência, Equipe e Financeiro.
  // Vendedor (e Gerente em Modo Vendedor) cai no fluxo do vendedor.
  const fullView = isManager || isStaff || isFinanceiro;

  const subtitle = isFinanceiro
    ? "Agenda completa de todos os artistas com status financeiro de cada show."
    : isManager || isStaff
      ? "Agenda completa de todos os artistas. Use os shows para aprovar, rejeitar, cancelar ou remarcar."
      : isVendedor
        ? "Calendário dos artistas liberados para você. Veja datas livres e proponha novos shows."
        : "Calendário unificado dos artistas.";

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-semibold">Agenda</h1>
        <p className="text-muted-foreground mt-1">{subtitle}</p>
      </div>
      {fullView ? <FinanceiroAgenda /> : <VendedorAgenda />}
    </div>
  );
}
