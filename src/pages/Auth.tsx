import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Music2, Loader2, MailCheck, ArrowLeft } from "lucide-react";
import { z } from "zod";

const schema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres.").max(72),
  nome: z.string().trim().min(1, "Informe seu nome").max(100).optional(),
});

const emailSchema = z.string().trim().email("E-mail inválido").max(255);

type View = "tabs" | "forgot" | "forgot-sent";

export default function Auth() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [view, setView] = useState<View>("tabs");
  const [forgotEmail, setForgotEmail] = useState("");
  const [sentToEmail, setSentToEmail] = useState("");

  useEffect(() => {
    const hash = window.location.hash;
    if (hash && /type=(invite|recovery)/.test(hash)) {
      navigate(`/aceitar-convite${hash}`, { replace: true });
      return;
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/app", { replace: true });
    });
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message === "Invalid login credentials" ? "E-mail ou senha incorretos" : error.message);
    } else {
      navigate("/app", { replace: true });
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password, nome });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { nome },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Conta criada. Verifique seu e-mail (se exigido) e faça login.");
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = emailSchema.safeParse(forgotEmail);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: `${window.location.origin}/aceitar-convite`,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSentToEmail(parsed.data);
    setView("forgot-sent");
  };

  const Logo = (
    <div className="text-center mb-8">
      <div className="inline-flex items-center gap-2 mb-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-accent flex items-center justify-center shadow-soft">
          <Music2 className="h-5 w-5 text-accent-foreground" />
        </div>
        <span className="text-2xl font-semibold tracking-tight">Stage</span>
      </div>
      <p className="text-sm text-muted-foreground">Gestão para produtoras musicais</p>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-surface">
      <div className="w-full max-w-md">
        {Logo}

        {view === "tabs" && (
          <Card className="p-6 shadow-elevated">
            <Tabs defaultValue="login">
              <TabsList className="grid grid-cols-2 w-full mb-4">
                <TabsTrigger value="login">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Criar conta</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="email">E-mail</Label>
                    <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Senha</Label>
                      <button
                        type="button"
                        onClick={() => {
                          setForgotEmail(email);
                          setView("forgot");
                        }}
                        className="text-xs text-accent hover:underline"
                      >
                        Esqueci minha senha
                      </button>
                    </div>
                    <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Entrar
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="nome">Nome</Label>
                    <Input id="nome" required value={nome} onChange={(e) => setNome(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email-s">E-mail</Label>
                    <Input id="email-s" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="password-s">Senha</Label>
                    <Input id="password-s" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Criar conta
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    A primeira conta criada deve receber o papel de <span className="font-medium text-foreground">gerente</span> manualmente no banco.
                  </p>
                </form>
              </TabsContent>
            </Tabs>
          </Card>
        )}

        {view === "forgot" && (
          <Card className="p-6 shadow-elevated">
            <button
              type="button"
              onClick={() => setView("tabs")}
              className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar ao login
            </button>
            <h2 className="text-xl font-semibold">Redefinir senha</h2>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Informe seu e-mail e enviaremos um link para você criar uma nova senha.
            </p>
            <form onSubmit={handleForgot} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="forgot-email">E-mail</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Enviar link de redefinição
              </Button>
            </form>
          </Card>
        )}

        {view === "forgot-sent" && (
          <Card className="p-6 shadow-elevated text-center">
            <div className="mx-auto h-14 w-14 rounded-full bg-accent/10 flex items-center justify-center mb-4">
              <MailCheck className="h-7 w-7 text-accent" />
            </div>
            <h2 className="text-xl font-semibold">Verifique seu e-mail</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Enviamos um link de redefinição para{" "}
              <span className="font-medium text-foreground">{sentToEmail}</span>.
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Não encontrou? Confira a caixa de spam ou lixo eletrônico.
            </p>
            <div className="flex flex-col gap-2 mt-6">
              <Button variant="outline" onClick={() => setView("forgot")}>
                Reenviar e-mail
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setForgotEmail("");
                  setSentToEmail("");
                  setView("tabs");
                }}
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Voltar ao login
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
