import { useEffect, useRef } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscreve mudanças em uma ou mais tabelas via Realtime e dispara
 * invalidação de queries com debounce — evita refetch em rajada quando
 * vários eventos chegam juntos (ex: aprovação dispara update + insert
 * em notifications no mesmo instante).
 *
 * Uso:
 *   useRealtimeInvalidate({
 *     channel: "shows-page",
 *     tables: ["shows", "show_payments"],
 *     queryKeys: [["shows"], ["financeiro"]],
 *     debounceMs: 400,
 *   });
 */
export function useRealtimeInvalidate(opts: {
  channel: string;
  tables: string[];
  queryKeys: QueryKey[];
  debounceMs?: number;
  enabled?: boolean;
  onEvent?: () => void;
}) {
  const { channel, tables, queryKeys, debounceMs = 300, enabled = true, onEvent } = opts;
  const qc = useQueryClient();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const flush = () => {
      timer.current = null;
      for (const key of queryKeys) qc.invalidateQueries({ queryKey: key });
      onEvent?.();
    };
    const trigger = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, debounceMs);
    };

    let ch = supabase.channel(channel);
    for (const table of tables) {
      ch = ch.on("postgres_changes" as any, { event: "*", schema: "public", table }, trigger);
    }
    ch.subscribe();

    return () => {
      if (timer.current) clearTimeout(timer.current);
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, enabled, debounceMs, tables.join(","), JSON.stringify(queryKeys)]);
}
