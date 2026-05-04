// Botão dropdown reutilizável "Exportar" com PDF e CSV.
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileText, FileSpreadsheet } from "lucide-react";

interface Props {
  onExportPDF: () => void;
  onExportCSV: () => void;
  disabled?: boolean;
  label?: string;
  size?: "default" | "sm" | "lg";
}

export function ExportMenu({ onExportPDF, onExportCSV, disabled, label = "Exportar", size = "sm" }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size={size} disabled={disabled} className="gap-2">
          <Download className="h-4 w-4" />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onExportPDF} className="gap-2 cursor-pointer">
          <FileText className="h-4 w-4" /> PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onExportCSV} className="gap-2 cursor-pointer">
          <FileSpreadsheet className="h-4 w-4" /> CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
