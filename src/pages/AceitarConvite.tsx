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
    nome: z.string().trim().min(2, "Informe seu nome completo").max(120),
    telefone: z.string().trim().min(8, "Informe um telefone válido").max(40),
    password: z.string().min(6, "Senha deve ter ao menos 6 caracteres").max(72),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "As senhas não conferem",
    path: ["confirm"],
  });

export default function AceitarConvite() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setHasSession(true);
        setEmail(session.user.email ?? null);
        setUserId(session.user.id);
        const meta = session.user.user_metadata as Record<string, unknown> | undefined;
        if (typeof meta?.nome === "string" && !nome) setNome(meta.nome);
        else if (typeof meta?.full_name === "string" && !nome) setNome(meta.full_name as string);
        setChecking(false);
      }
    });

    (async () => {
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
        window.history.replaceState(null, "", window.location.pathname);
        if (!error && data.session?.user) {
          setHasSession(true);
          setEmail(data.session.user.email ?? null);
          setUserId(data.session.user.id);
          const meta = data.session.user.user_metadata as Record<string, unknown> | undefined;
          if (typeof meta?.nome === "string") setNome(meta.nome);
          else if (typeof meta?.full_name === "string") setNome(meta.full_name as string);
          setChecking(false);
          return;
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setHasSession(true);
        setEmail(session.user.email ?? null);
        setUserId(session.user.id);
        const meta = session.user.user_metadata as Record<string, unknown> | undefined;
        if (typeof meta?.nome === "string") setNome(meta.nome);
        else if (typeof meta?.full_name === "string") setNome(meta.full_name as string);
      }
      setChecking(false);
    })();

    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ nome, telefone, password, confirm });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    if (!userId) {
      toast.error("Sessão inválida. Solicite um novo convite.");
      return;
    }
    setLoading(true);

    const { error: updateError } = await supabase.auth.updateUser({
      password: parsed.data.password,
      data: {
        full_name: parsed.data.nome,
        nome: parsed.data.nome,
        telefone: parsed.data.telefone,
      },
    });
    if (updateError) {
      setLoading(false);
      toast.error(updateError.message);
      return;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .upsert(
        {
          id: userId,
          nome: parsed.data.nome,
          telefone: parsed.data.telefone,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );
    setLoading(false);
    if (profileError) {
      toast.error("Senha definida, mas não foi possível salvar o perfil. Atualize em Meu perfil.");
      navigate("/app", { replace: true });
      return;
    }

    toast.success("Bem-vindo ao Stage!");
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
          <p className="text-sm text-muted-foreground">Complete seu cadastro para acessar</p>
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
                <Label htmlFor="nome">Nome completo *</Label>
                <Input
                  id="nome"
                  required
                  maxLength={120}
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Seu nome completo"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="telefone">Telefone / WhatsApp *</Label>
                <Input
                  id="telefone"
                  required
                  maxLength={40}
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Nova senha *</Label>
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
                <Label htmlFor="confirm">Confirmar senha *</Label>
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
                Criar conta e entrar
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
