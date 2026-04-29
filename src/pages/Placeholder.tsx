import { Card } from "@/components/ui/card";
import { Construction } from "lucide-react";

export default function Placeholder({ title, description }: { title: string; description: string }) {
  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <h1 className="text-2xl md:text-3xl font-semibold mb-2">{title}</h1>
      <p className="text-muted-foreground mb-6">{description}</p>
      <Card className="p-12 text-center shadow-soft">
        <Construction className="h-10 w-10 text-accent mx-auto mb-3" />
        <p className="font-medium">Em construção</p>
        <p className="text-sm text-muted-foreground mt-1">Esta tela faz parte do piloto e será entregue na próxima fase.</p>
      </Card>
    </div>
  );
}
