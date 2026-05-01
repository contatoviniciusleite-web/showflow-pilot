import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Plus, Trash2, Ban } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Block {
  id: string;
  artist_id: string | null;
  artist_nome: string | null;
  artist_cor: string | null;
  data: string;
  motivo: string | null;
  created_at: string;
  created_by_nome: string | null;
}

interface Artist {
  id: string;
  nome: string;
  cor: string;
}

const GLOBAL_VALUE = "__all__";

export default function Bloqueios() {
  const { session } = useAuth();
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // form state
  const [artistId, setArtistId] = useState<string>(GLOBAL_VALUE);
  const [date, setDate] = useState<Date | undefined>();
  const [motivo, setMotivo] = useState("");

  const load = async () => {
    if (!session) return;
    setLoading(true);
    const [blocksRes, artistsRes] = await Promise.all([
      supabase.functions.invoke("shows-admin", { body: { action: "list_blocks" } }),
      supabase.functions.invoke("shows-admin", { body: { action: "artists" } }),
    ]);
    if (blocksRes.error) {
      toast({ title: "Erro ao carregar bloqueios", description: blocksRes.error.message, variant: "destructive" });
    } else {
      setBlocks(blocksRes.data?.blocks ?? []);
    }
    if (!artistsRes.error) setArtists(artistsRes.data?.artists ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token]);

  const reset = () => {
    setArtistId(GLOBAL_VALUE);
    setDate(undefined);
    setMotivo("");
  };

  const handleCreate = async () => {
    if (!date) {
      toast({ title: "Selecione uma data", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("shows-admin", {
      body: {
        action: "create_block",
        data: format(date, "yyyy-MM-dd"),
        artist_id: artistId === GLOBAL_VALUE ? null : artistId,
        motivo: motivo || null,
      },
    });
    setSubmitting(false);
    if (error || data?.error) {
      toast({ title: "Não foi possível bloquear", description: data?.error ?? error?.message, variant: "destructive" });
      return;
    }
    toast({ title: "Data bloqueada" });
    setOpen(false);
    reset();
    void load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remover este bloqueio?")) return;
    const { data, error } = await supabase.functions.invoke("shows-admin", {
      body: { action: "delete_block", id },
    });
    if (error || data?.error) {
      toast({ title: "Erro", description: data?.error ?? error?.message, variant: "destructive" });
      return;
    }
    toast({ title: "Bloqueio removido" });
    void load();
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Ban className="h-6 w-6" />
            Datas bloqueadas
          </h1>
          <p className="text-sm text-muted-foreground">
            Trave datas em que um artista (ou todos) não podem ter shows criados.
          </p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" /> Bloquear data
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Bloquear data</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Artista</Label>
                <Select value={artistId} onValueChange={setArtistId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={GLOBAL_VALUE}>Todos os artistas (global)</SelectItem>
                    {artists.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Data</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date ? format(date, "PPP", { locale: ptBR }) : "Escolha a data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={setDate}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Motivo (opcional)</Label>
                <Input
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Ex.: Férias, folga, manutenção..."
                  maxLength={500}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreate} disabled={submitting}>
                {submitting ? "Salvando..." : "Bloquear"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bloqueios cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Carregando...</p>
          ) : blocks.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhum bloqueio cadastrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Artista</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Criado por</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {blocks.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">
                      {format(new Date(`${b.data}T12:00:00`), "dd/MM/yyyy (EEE)", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      {b.artist_id ? (
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: b.artist_cor ?? "#888" }}
                          />
                          {b.artist_nome ?? "—"}
                        </span>
                      ) : (
                        <Badge variant="secondary">Todos</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                      {b.motivo ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {b.created_by_nome ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(b.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
