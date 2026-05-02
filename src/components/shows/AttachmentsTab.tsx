import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { FileText, Image as ImageIcon, Eye, Download, Trash2, Upload, Loader2 } from "lucide-react";
import { canDeleteAttachment } from "@/lib/permissions";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Attachment {
  id: string;
  show_id: string;
  tipo: string;
  file_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: string;
  uploaded_by_nome: string | null;
  created_at: string;
}

interface Props {
  showId: string;
  artistNome?: string | null;
  showDate?: string | null;
  /** Pode anexar (vendedor criador, gerência, equipe, financeiro) */
  canUpload: boolean;
}

export function AttachmentsTab({ showId, artistNome, showDate, canUpload }: Props) {
  const { roles } = useAuth();
  const [items, setItems] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("shows-admin", {
      body: { action: "list_attachments", show_id: showId },
    });
    if (error) toast.error(error.message);
    setItems((data?.attachments ?? []) as Attachment[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [showId]);

  const handleUpload = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/pdf,image/png,image/jpeg,image/jpg";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const allowed = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];
      if (!allowed.includes(file.type)) return toast.error("Use PDF, JPG, JPEG ou PNG.");
      if (file.size > 10 * 1024 * 1024) return toast.error("Arquivo excede 10MB.");
      setUploading(true);
      try {
        const ext = (file.name.split(".").pop() ?? "bin").toLowerCase();
        const slug = (artistNome ?? "anexo").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
        const path = `${showId}/${slug}-${showDate ?? "data"}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("comprovantes").upload(path, file, {
          contentType: file.type, upsert: false,
        });
        if (upErr) throw upErr;
        const { error } = await supabase.functions.invoke("shows-admin", {
          body: {
            action: "add_attachment",
            show_id: showId,
            path,
            file_name: file.name,
            mime_type: file.type,
            size_bytes: file.size,
            tipo: "comprovante",
          },
        });
        if (error) throw error;
        toast.success("Anexo adicionado");
        load();
      } catch (e: any) {
        toast.error(e?.message ?? "Falha ao enviar");
      } finally {
        setUploading(false);
      }
    };
    input.click();
  };

  const view = async (id: string) => {
    const { data, error } = await supabase.functions.invoke("shows-admin", {
      body: { action: "attachment_signed_url", id },
    });
    if (error) return toast.error(error.message);
    if (data?.url) window.open(data.url, "_blank");
  };

  const download = async (att: Attachment) => {
    const { data, error } = await supabase.functions.invoke("shows-admin", {
      body: { action: "attachment_signed_url", id: att.id },
    });
    if (error) return toast.error(error.message);
    if (data?.url) {
      const a = document.createElement("a");
      a.href = data.url; a.download = att.file_name; a.target = "_blank";
      document.body.appendChild(a); a.click(); a.remove();
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este anexo?")) return;
    const { error } = await supabase.functions.invoke("shows-admin", {
      body: { action: "delete_attachment", id },
    });
    if (error) return toast.error(error.message);
    toast.success("Anexo excluído");
    load();
  };

  const canDelete = canDeleteAttachment(roles);

  return (
    <div className="space-y-3">
      {canUpload && (
        <div className="flex justify-end">
          <Button size="sm" onClick={handleUpload} disabled={uploading}>
            {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            Anexar arquivo
          </Button>
        </div>
      )}
      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : items.length === 0 ? (
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          Nenhum anexo neste show.
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((a) => {
            const isImage = (a.mime_type ?? "").startsWith("image/");
            return (
              <li key={a.id} className="flex items-center justify-between gap-3 border rounded-md p-3">
                <div className="flex items-center gap-3 min-w-0">
                  {isImage ? <ImageIcon className="h-5 w-5 shrink-0 text-muted-foreground" /> : <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />}
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{a.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.uploaded_by_nome ?? "—"} · {format(new Date(a.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="icon" variant="ghost" onClick={() => view(a.id)} title="Visualizar"><Eye className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => download(a)} title="Baixar"><Download className="h-4 w-4" /></Button>
                  {canDelete && (
                    <Button size="icon" variant="ghost" onClick={() => remove(a.id)} title="Excluir">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
