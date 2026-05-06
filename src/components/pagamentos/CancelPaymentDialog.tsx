import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export function CancelPaymentDialog({
  open, onOpenChange, orderId, onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  orderId: string | null;
  onDone: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!orderId || !motivo.trim()) return toast.error("Informe o motivo");
    setSaving(true);
    const { error } = await supabase.from("payment_orders").update({
      status: "cancelado", motivo_cancelamento: motivo,
    }).eq("id", orderId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Ordem cancelada");
    onDone();
    onOpenChange(false);
    setMotivo("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Cancelar ordem de pagamento</DialogTitle></DialogHeader>
        <div className="space-y-1.5">
          <Label>Motivo do cancelamento *</Label>
          <Textarea rows={4} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Voltar</Button>
          <Button variant="destructive" onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Cancelar ordem
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
