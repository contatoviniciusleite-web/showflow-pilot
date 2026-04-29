import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { CalendarDays, Music2, Users, Wallet } from "lucide-react";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const { user, roles } = useAuth();

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-semibold">Olá{user?.email ? `, ${user.email.split("@")[0]}` : ""}</h1>
        <p className="text-muted-foreground mt-1">Visão geral da produtora.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total a receber (mês)", value: "R$ —", icon: Wallet, hint: "Sem dados ainda" },
          { label: "Total recebido (mês)", value: "R$ —", icon: Wallet, hint: "Sem dados ainda" },
          { label: "Despesas (mês)", value: "R$ —", icon: Wallet, hint: "Sem dados ainda" },
          { label: "Próximos shows", value: "—", icon: CalendarDays, hint: "Sem dados ainda" },
        ].map((c) => (
          <Card key={c.label} className="p-5 shadow-soft">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{c.label}</p>
                <p className="text-2xl font-semibold mt-2">{c.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{c.hint}</p>
              </div>
              <div className="h-9 w-9 rounded-md bg-accent/10 flex items-center justify-center">
                <c.icon className="h-4 w-4 text-accent" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-6 shadow-soft">
        <div className="flex items-center gap-3 mb-3">
          <Music2 className="h-5 w-5 text-accent" />
          <h2 className="text-lg font-semibold">Comece pelo cadastro dos artistas</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Cadastre os 6 artistas com nome, foto, ID do Google Calendar e rider padrão. Depois você poderá criar minutas de show e ver tudo na agenda.
        </p>
        {roles.includes("gerente") ? (
          <Link to="/artistas" className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-accent-foreground text-sm font-medium hover:opacity-90 transition">
            <Users className="h-4 w-4" />
            Gerenciar artistas
          </Link>
        ) : (
          <p className="text-sm text-muted-foreground">Peça ao gerente para cadastrar os artistas.</p>
        )}
      </Card>
    </div>
  );
}
