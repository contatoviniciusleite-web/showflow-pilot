import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Music2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="text-center space-y-6 px-6">
        <div className="flex justify-center">
          <div className="h-16 w-16 rounded-xl bg-gradient-accent flex items-center justify-center">
            <Music2 className="h-8 w-8 text-accent-foreground" />
          </div>
        </div>
        <div>
          <h1 className="text-6xl font-bold tracking-tight">404</h1>
          <p className="mt-2 text-xl text-muted-foreground">Página não encontrada</p>
        </div>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
          A rota <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{location.pathname}</code> não existe neste aplicativo.
        </p>
        <Button asChild>
          <a href="/">Voltar ao início</a>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
