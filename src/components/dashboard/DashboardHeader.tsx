import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export function DashboardHeader({
  name,
  subtitle,
  roleLabel,
}: {
  name: string;
  subtitle: string;
  roleLabel: string;
}) {
  const now = new Date();
  return (
    <div className="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-3">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl md:text-3xl font-semibold">
            {greeting(now)}, {name}! 👋
          </h1>
          <Badge variant="secondary">{roleLabel}</Badge>
        </div>
        <p className="text-muted-foreground mt-1">{subtitle}</p>
      </div>
      <p className="text-sm text-muted-foreground capitalize">
        {format(now, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
      </p>
    </div>
  );
}
