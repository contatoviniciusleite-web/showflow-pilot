import { useEffectiveRoles } from "@/contexts/ManagerModeContext";
import { VendedorAgenda } from "@/components/dashboard/VendedorAgenda";
import { FinanceiroAgenda } from "@/components/dashboard/FinanceiroAgenda";
import { SocioAgenda } from "@/components/dashboard/SocioAgenda";

export default function AgendaPage() {
  const roles = useEffectiveRoles();
  const isFinanceiro = roles.includes("financeiro");
  const isManager = roles.includes("gerente");
  const isStaff = roles.includes("equipe");
  const isDiretor = roles.includes("diretor");
  const isVendedor = roles.includes("vendedor");
  const isSocio = roles.includes("socio");

  // Sócio tem visão restrita aos artistas vinculados (somente leitura).
  // Visão completa para Diretor, Gerência, Equipe e Financeiro.
  // Vendedor cai no fluxo do vendedor.
  const fullView = isManager || isStaff || isFinanceiro || isDiretor;

  let subtitle = "Calendário unificado dos artistas.";
  if (isSocio && !fullView && !isVendedor) {
    subtitle = "Agenda dos artistas vinculados a você.";
  } else if (isFinanceiro) {
    subtitle = "Agenda completa de todos os artistas com status financeiro de cada show.";
  } else if (isManager || isStaff || isDiretor) {
    subtitle = "Agenda completa de todos os artistas. Use os shows para aprovar, rejeitar, cancelar ou remarcar.";
  } else if (isVendedor) {
    subtitle = "Calendário dos artistas liberados para você. Veja datas livres e proponha novos shows.";
  }

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      <div className="mb-4">
        <h1 className="text-2xl md:text-3xl font-semibold">Agenda</h1>
        <p className="text-muted-foreground mt-1 text-sm">{subtitle}</p>
      </div>
      {fullView ? (
        <FinanceiroAgenda />
      ) : isVendedor ? (
        <VendedorAgenda />
      ) : isSocio ? (
        <SocioAgenda />
      ) : (
        <VendedorAgenda />
      )}
    </div>
  );
}
