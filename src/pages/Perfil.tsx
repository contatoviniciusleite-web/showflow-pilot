import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, UserCircle2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { maskPhone, phoneDigits, toStoredPhone, fromStoredPhone } from "@/lib/phone";

const schema = z.object({
  nome: z
    .string()
    .trim()
    .min(2, "Informe seu nome completo")
    .max(120, "Nome muito longo"),
  telefoneDigits: z
    .string()
    .refine((v) => v === "" || v.length >= 10, "Telefone deve ter ao menos 10 dígitos")
    .refine((v) => v.length <= 11, "Telefone inválido"),
});

export default function Perfil() {
  const navigate = useNavigate();
  const { user, roles } = useAuth();
  const { profile, loading, reload } = useProfile();
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setNome(profile.nome ?? "");
      setTelefone(fromStoredPhone(profile.telefone));
    }
  }, [profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const digits = phoneDigits(telefone);
    const parsed = schema.safeParse({ nome, telefoneDigits: digits });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    const stored = toStoredPhone(telefone) || null;
    setSaving(true);
    const { error: profileError } = await supabase
      .from("profiles")
      .upsert(
        {
          id: user.id,
          nome: parsed.data.nome,
          telefone: stored,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );
    if (profileError) {
      setSaving(false);
      toast.error(profileError.message);
      return;
    }
    const { error: metaError } = await supabase.auth.updateUser({
      data: {
        full_name: parsed.data.nome,
        nome: parsed.data.nome,
        telefone: stored,
      },
    });
    setSaving(false);
    if (metaError) {
      toast.error(metaError.message);
      return;
    }
    toast.success("Perfil atualizado!");
    await reload();
  };

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <UserCircle2 className="h-7 w-7 text-accent" />
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold">Meu perfil</h1>
          <p className="text-sm text-muted-foreground">
            Mantenha seus dados atualizados.
          </p>
        </div>
      </div>

      <Card className="p-6">
        {loading ? (
          <div className="py-10 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input value={user?.email ?? ""} disabled />
            </div>
            <div className="space-y-1.5">
              <Label>Papéis</Label>
              <Input value={roles.join(", ") || "—"} disabled />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nome">Nome completo *</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                maxLength={120}
                required
                placeholder="Seu nome completo"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="telefone">Telefone / WhatsApp</Label>
              <div className="flex">
                <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-sm text-muted-foreground">
                  +55
                </span>
                <Input
                  id="telefone"
                  className="rounded-l-none"
                  value={telefone}
                  onChange={(e) => setTelefone(maskPhone(e.target.value))}
                  inputMode="tel"
                  placeholder="(11) 99999-9999"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar alterações
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                Voltar
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
