import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Music2, Loader2 } from "lucide-react";
import { z } from "zod";

const schema = z
  .object({
    password: z.string().min(6, "Senha deve ter ao menos 6 caracteres").max(72),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: "As senhas não conferem", path: ["confirm"] });

export default function AceitarConvite() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setHasSession(true);
        setEmail(session.user.email ?? null);
        setChecking(false);
      }
    });

    (async () => {
      // 1) Tenta ler tokens do hash (#access_token=...&refresh_token=...&type=invite)
      const hash = window.location.hash.startsWith("#")
        ? window.location.hash.substring(1)
        : window.location.hash;
      const hashParams = new URLSearchParams(hash);
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (accessToken && refreshToken) {
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        // Limpa o hash da URL
        window.history.replaceState(null, "", window.location.pathname);
        if (!error && data.session?.user) {
          setHasSession(true);
          setEmail(data.session.user.email ?? null);
          setChecking(false);
          return;
        }
      }

      // 2) Fallback: sessão já existente
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setHasSession(true);
        setEmail(session.user.email ?? null);
      }
      setChecking(false);
    })();

    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ password, confirm });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Senha definida! Bem-vindo.");
    navigate("/app", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-surface">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-accent flex items-center justify-center shadow-soft">
              <Music2 className="h-5 w-5 text-accent-foreground" />
            </div>
            <span className="text-2xl font-semibold tracking-tight">Stage</span>
          </div>
          <p className="text-sm text-muted-foreground">Defina sua senha para acessar</p>
        </div>

        <Card className="p-6 shadow-elevated">
          {checking ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !hasSession ? (
            <div className="space-y-3 text-center">
              <p className="text-sm text-muted-foreground">
                Convite inválido ou expirado. Solicite ao gerente que reenvie o convite.
              </p>
              <Button variant="outline" onClick={() => navigate("/auth")} className="w-full">
                Ir para login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {email && (
                <p className="text-sm text-muted-foreground">
                  Conta: <span className="font-medium text-foreground">{email}</span>
                </p>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="password">Nova senha</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirmar senha</Label>
                <Input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Definir senha e entrar
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
