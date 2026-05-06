// Modal de exportação da lista de Ordens de Pagamento (PDF/CSV).
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Download, FileText, FileSpreadsheet } from "lucide-react";
import { exportPaymentOrdersPDF, exportPaymentOrdersCSV, type PaymentOrderExport, type ExportFilters } from "@/lib/paymentOrdersExport";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  groups: { closingId: string; closing: PaymentOrderExport["closing"]; orders: PaymentOrderExport[] }[];
  filters: ExportFilters;
}

export function ExportPaymentOrdersDialog({ open, onOpenChange, groups, filters }: Props) {
  const [format, setFormat] = useState<"pdf" | "csv">("pdf");

  const handleExport = () => {
    if (format === "pdf") exportPaymentOrdersPDF(groups, filters);
    else exportPaymentOrdersCSV(groups, filters);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Exportar lista de pagamentos</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            A exportação respeita os filtros ativos na tela.
          </p>
          <div>
            <Label className="mb-2 block">Formato</Label>
            <RadioGroup value={format} onValueChange={(v) => setFormat(v as any)} className="space-y-2">
              <div className="flex items-center gap-3 rounded-md border p-3 cursor-pointer" onClick={() => setFormat("pdf")}>
                <RadioGroupItem value="pdf" id="fmt-pdf" />
                <FileText className="h-4 w-4" />
                <Label htmlFor="fmt-pdf" className="cursor-pointer flex-1">PDF (visual, com agrupamento)</Label>
              </div>
              <div className="flex items-center gap-3 rounded-md border p-3 cursor-pointer" onClick={() => setFormat("csv")}>
                <RadioGroupItem value="csv" id="fmt-csv" />
                <FileSpreadsheet className="h-4 w-4" />
                <Label htmlFor="fmt-csv" className="cursor-pointer flex-1">CSV (Excel pt-BR)</Label>
              </div>
            </RadioGroup>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleExport} className="gap-2">
            <Download className="h-4 w-4" /> Exportar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
