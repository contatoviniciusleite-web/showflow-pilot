import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { fmtDateBR } from "@/lib/exporters";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  closing: {
    id: string;
    semana_inicio: string;
    semana_fim: string;
    status: string;
    artistName?: string | null;
  } | null;
  onDeleted?: () => void;
}

export function DeleteClosingDialog({ open, onOpenChange, closing, onDeleted }: Props) {
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    if (open) setConfirm("");
  }, [open]);

  if (!closing) return null;
  const isFinalizado = closing.status === "finalizado";
  const canConfirm = !isFinalizado || confirm.trim().toUpperCase() === "EXCLUIR";

  const onDelete = async () => {
    if (!canConfirm) return;
    setBusy(true);
    const { error } = await supabase.from("weekly_closings").delete().eq("id", closing.id);
    setBusy(false);
    if (error) {
      toast.error(error.message ?? "Falha ao excluir fechamento");
      return;
    }
    toast.success("Fechamento excluído com sucesso.");
    onOpenChange(false);
    onDeleted?.();
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir fechamento?</AlertDialogTitle>
          <AlertDialogDescription>
            Você está prestes a excluir o fechamento de{" "}
            <strong>{fmtDateBR(closing.semana_inicio)}</strong> a{" "}
            <strong>{fmtDateBR(closing.semana_fim)}</strong>
            {closing.artistName ? <> do artista <strong>{closing.artistName}</strong></> : null}.
            Esta ação não pode ser desfeita. Todos os lançamentos de equipe, despesas, clipe e
            investimentos deste fechamento serão removidos permanentemente.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {isFinalizado && (
          <div className="space-y-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <p className="font-medium">
              ⚠️ Atenção: este fechamento já foi FINALIZADO. Excluí-lo irá remover um registro
              oficial. Tem certeza absoluta?
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-excluir">
                Digite <strong>EXCLUIR</strong> para habilitar o botão:
              </Label>
              <Input
                id="confirm-excluir"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="EXCLUIR"
                autoComplete="off"
              />
            </div>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); onDelete(); }}
            disabled={busy || !canConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Excluir permanentemente
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
