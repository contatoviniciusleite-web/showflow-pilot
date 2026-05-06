import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export function SchedulePaymentDialog({
  open, onOpenChange, orderId, dataSugerida, onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  orderId: string | null;
  dataSugerida: string | null;
  onDone: () => void;
}) {
  const [data, setData] = useState(dataSugerida ?? "");
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);

  // reset when opening
  if (open && data === "" && dataSugerida) setData(dataSugerida);

  const submit = async () => {
    if (!orderId || !data) return toast.error("Informe a data");
    setSaving(true);
    const { error } = await supabase.from("payment_orders").update({
      status: "agendado", data_pagamento: data,
      observacoes: obs || null,
    }).eq("id", orderId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Ordem agendada");
    onDone();
    onOpenChange(false);
    setData(""); setObs("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Agendar pagamento</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Data de pagamento *</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea rows={3} value={obs} onChange={(e) => setObs(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Agendar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
