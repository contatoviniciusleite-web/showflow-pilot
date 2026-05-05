import { useEffect, useState } from "react";
import { Bell, Check, CheckCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

type NotifTipo =
  | "minuta_aprovada"
  | "minuta_rejeitada"
  | "comprovante_enviado"
  | "pagamento_confirmado"
  | "prazo_proximo"
  | "show_cancelado_prazo";

interface Notification {
  id: string;
  tipo: NotifTipo;
  titulo: string;
  mensagem: string;
  show_id: string | null;
  lida: boolean;
  created_at: string;
}

const TIPO_COR: Record<NotifTipo, string> = {
  minuta_aprovada: "bg-green-500",
  pagamento_confirmado: "bg-green-500",
  comprovante_enviado: "bg-orange-500",
  prazo_proximo: "bg-amber-500",
  minuta_rejeitada: "bg-destructive",
  show_cancelado_prazo: "bg-destructive",
};

export function NotificationBell() {
  const { session, signOut } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

  const handleAuthError = async (error: any) => {
    const status = error?.context?.status ?? error?.status;
    const msg = String(error?.message ?? "");
    if (status === 401 || /Sess[aã]o (inv|aus)/i.test(msg) || /JWT|sub claim|refresh/i.test(msg)) {
      try { await signOut(); } catch { /* noop */ }
      return true;
    }
    return false;
  };

  const invokeNotif = async (body: any) => {
    if (!session?.access_token) return { data: null, error: new Error("no-session") };
    return supabase.functions.invoke("notifications", {
      body,
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
  };

  const loadCount = async () => {
    if (!session?.access_token) return;
    const { data, error } = await invokeNotif({ action: "unread_count" });
    if (error) { await handleAuthError(error); return; }
    setUnread(data?.count ?? 0);
  };
  const loadList = async () => {
    if (!session?.access_token) return;
    const { data, error } = await invokeNotif({ action: "list" });
    if (error) { await handleAuthError(error); return; }
    setItems((data?.notifications ?? []) as Notification[]);
  };

  useEffect(() => {
    if (!session) {
      setUnread(0);
      setItems([]);
      return;
    }
    loadCount();
    const id = window.setInterval(loadCount, 30000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token]);

  useEffect(() => {
    if (open && session) loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, session?.access_token]);

  const markAll = async () => {
    const { error } = await invokeNotif({ action: "mark_read" });
    if (error) {
      if (await handleAuthError(error)) return;
      return toast.error(error.message);
    }
    await Promise.all([loadList(), loadCount()]);
  };
  const markOne = async (id: string) => {
    const { error } = await invokeNotif({ action: "mark_read", id });
    if (error) { await handleAuthError(error); return; }
    await Promise.all([loadList(), loadCount()]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold flex items-center justify-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between p-3 border-b">
          <p className="font-semibold text-sm">Notificações</p>
          {items.some((i) => !i.lida) && (
            <Button size="sm" variant="ghost" onClick={markAll}>
              <CheckCheck className="h-3.5 w-3.5 mr-1" />
              Marcar todas
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-96">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sem notificações</p>
          ) : (
            <ul className="divide-y">
              {items.map((n) => (
                <li
                  key={n.id}
                  className={cn(
                    "p-3 text-sm space-y-1",
                    !n.lida && "bg-accent/5",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium flex items-center gap-2">
                        <span
                          className={cn(
                            "h-2 w-2 rounded-full",
                            TIPO_COR[n.tipo] ?? "bg-muted-foreground",
                          )}
                        />
                        {n.titulo}
                      </p>
                      <p className="text-muted-foreground text-xs mt-1">{n.mensagem}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {new Date(n.created_at).toLocaleString("pt-BR")}
                      </p>
                    </div>
                    {!n.lida && (
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => markOne(n.id)}>
                        <Check className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
