import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

const APPROVAL_SAMPLE = `🎵 *ShowFlow — Stage*

Nova minuta aguardando sua aprovação!

🎤 Artista: MC KITINHO
📍 Local: Evva Club — Ribeirão Preto
📅 Data: 10/05/2026 às 23:00
💰 Cachê: R$ 10.000,00
👤 Vendedor: Vinicius Leite

Responda:
*1* para APROVAR ✅
*2* para REJEITAR ❌`;

export default function WhatsappTest() {
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const sanitizePhone = (raw: string) => raw.replace(/\D/g, "");

  async function send(body: string) {
    const digits = sanitizePhone(phone);
    if (!digits) {
      setResult({ ok: false, text: "Informe um telefone válido." });
      return;
    }
    if (!body.trim()) {
      setResult({ ok: false, text: "Mensagem vazia." });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("twilio-whatsapp", {
        body: { to: `+55${digits}`, message: body },
      });
      if (error) throw error;
      setResult({ ok: true, text: `Sucesso: ${JSON.stringify(data)}` });
    } catch (err) {
      setResult({
        ok: false,
        text: `Erro: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Teste WhatsApp</h1>
        <p className="text-sm text-muted-foreground">
          Envie mensagens de teste via Twilio. Acesso restrito ao Diretor.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Envio</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Telefone (com DDD)</Label>
            <div className="flex gap-2">
              <div className="flex items-center px-3 rounded-md border bg-muted text-sm">
                +55
              </div>
              <Input
                id="phone"
                placeholder="11999999999"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="msg">Mensagem</Label>
            <Textarea
              id="msg"
              rows={6}
              placeholder="Digite a mensagem de teste..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => send(message)} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Enviar mensagem de teste
            </Button>
            <Button
              variant="secondary"
              onClick={() => send(APPROVAL_SAMPLE)}
              disabled={loading}
            >
              Testar aprovação de minuta
            </Button>
          </div>

          {result && (
            <div
              className={`text-sm rounded-md p-3 border ${
                result.ok
                  ? "bg-primary/10 border-primary/30 text-foreground"
                  : "bg-destructive/10 border-destructive/30 text-destructive"
              }`}
            >
              {result.text}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
