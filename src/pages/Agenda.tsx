import { useEffectiveRoles } from "@/contexts/ManagerModeContext";
import { VendedorAgenda } from "@/components/dashboard/VendedorAgenda";

export default function AgendaPage() {
  const roles = useEffectiveRoles();
  const isVendedor = roles.includes("vendedor");

  const subtitle = isVendedor
    ? "Calendário dos artistas liberados para você. Veja datas livres e proponha novos shows."
    : "Calendário unificado dos artistas.";

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-semibold">Agenda</h1>
        <p className="text-muted-foreground mt-1">{subtitle}</p>
      </div>
      <VendedorAgenda />
    </div>
  );
}
