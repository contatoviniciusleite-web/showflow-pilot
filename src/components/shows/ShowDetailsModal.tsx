import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { STATUS_CLASS, STATUS_LABEL } from "@/lib/showStatus";
import { AttachmentsTab } from "./AttachmentsTab";
import { PaymentsTab } from "./PaymentsTab";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ShowLite {
  id: string;
  artist_nome?: string | null;
  artist_cache_minimo?: number | null;
  data_show: string;
  horario?: string | null;
  local?: string | null;
  cidade?: string | null;
  cache_total?: number;
  status: string;
  vendedor?: string | null;
  contratante_nome?: string | null;
  created_by?: string | null;
  confirmado_por_nome?: string | null;
  confirmado_em?: string | null;
}

interface Props {
  show: ShowLite | null;
  open: boolean;
  onClose: () => void;
  onChanged?: () => void;
}

export function ShowDetailsModal({ show, open, onClose, onChanged }: Props) {
  const { roles, user } = useAuth();
  const [tab, setTab] = useState("geral");

  if (!show) return null;
  const isArtista = roles.includes("artista") && roles.length === 1;
  const isOwner = show.created_by && user?.id === show.created_by;
  const isVendedorOnly = roles.includes("vendedor") && !roles.includes("gerente") && !roles.includes("equipe") && !roles.includes("financeiro");
  const canUpload =
    roles.includes("gerente") || roles.includes("equipe") || roles.includes("financeiro") ||
    (roles.includes("vendedor") && isOwner);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {show.artist_nome ?? "Show"}
            <Badge className={(STATUS_CLASS as any)[show.status]}>{(STATUS_LABEL as any)[show.status] ?? show.status}</Badge>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="geral">Geral</TabsTrigger>
            {!isArtista && <TabsTrigger value="financeiro">Financeiro</TabsTrigger>}
            {!isArtista && <TabsTrigger value="anexos">Anexos</TabsTrigger>}
          </TabsList>

          <TabsContent value="geral" className="space-y-2 text-sm">
            <p><strong>Data:</strong> {format(new Date(show.data_show + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })}{show.horario ? ` às ${show.horario.slice(0,5)}` : ""}</p>
            {show.local && <p><strong>Local:</strong> {show.local}{show.cidade ? ` · ${show.cidade}` : ""}</p>}
            {show.contratante_nome && <p><strong>Contratante:</strong> {show.contratante_nome}</p>}
            {show.vendedor && <p><strong>Vendedor:</strong> {show.vendedor}</p>}
            {typeof show.cache_total === "number" && (
              <p><strong>Cachê:</strong> {Number(show.cache_total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
            )}
          </TabsContent>

          {!isArtista && (
            <TabsContent value="financeiro">
              <PaymentsTab
                showId={show.id}
                status={show.status}
                confirmadoPorNome={show.confirmado_por_nome}
                confirmadoEm={show.confirmado_em}
                onChanged={onChanged}
              />
            </TabsContent>
          )}

          {!isArtista && (
            <TabsContent value="anexos">
              <AttachmentsTab
                showId={show.id}
                artistNome={show.artist_nome}
                showDate={show.data_show}
                canUpload={canUpload}
              />
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
