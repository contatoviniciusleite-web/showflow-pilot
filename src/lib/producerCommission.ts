// Recalcula o saldo de comissão da produtora para um fechamento finalizado.
// Para cada vendedor presente nos shows incluídos:
//   base_liquida = cache_total - custo_equipe - van
//   comissao_vendedor = base_liquida * 0.10
//   comissao_descontada = cache_total * 0.10
//   saldo_produtora = comissao_descontada - comissao_vendedor
import { supabase } from "@/integrations/supabase/client";

const round2 = (n: number) => Math.round(n * 100) / 100;
const COMMISSION_RATE = 0.10;

export async function recalcProducerCommissionBalance(closingId: string) {
  // Carrega shows do fechamento + dados do show (vendedor)
  const { data: closing } = await supabase
    .from("weekly_closings")
    .select("id, artist_id")
    .eq("id", closingId)
    .maybeSingle();
  if (!closing) return;

  const { data: cs } = await supabase
    .from("weekly_closing_shows")
    .select("id, cache_total, comissao_vendedor, custo_equipe, incluido, show:shows(vendedor)")
    .eq("closing_id", closingId);

  // Van por show
  const { data: vanRows } = await supabase
    .from("weekly_closing_show_expenses" as any)
    .select("closing_show_id, valor, categoria, incluir_no_calculo")
    .eq("closing_id", closingId);

  const vanMap = new Map<string, number>();
  for (const r of (vanRows ?? []) as any[]) {
    if (r.categoria !== "van") continue;
    if (r.incluir_no_calculo === false) continue;
    if (!r.closing_show_id) continue;
    vanMap.set(r.closing_show_id, (vanMap.get(r.closing_show_id) ?? 0) + Number(r.valor || 0));
  }

  // Agrupar por vendedor
  type Acc = { vendedor: string; cache: number; equipe: number; van: number };
  const byVendor = new Map<string, Acc>();
  for (const s of (cs ?? []) as any[]) {
    if (!s.incluido) continue;
    const vendedor = (s.show?.vendedor ?? "").trim();
    if (!vendedor) continue;
    const acc = byVendor.get(vendedor) ?? { vendedor, cache: 0, equipe: 0, van: 0 };
    acc.cache += Number(s.cache_total || 0);
    acc.equipe += Number(s.custo_equipe || 0);
    acc.van += vanMap.get(s.id) ?? 0;
    byVendor.set(vendedor, acc);
  }

  // Limpa registros antigos
  await supabase.from("producer_commission_balance" as any).delete().eq("closing_id", closingId);

  const rows = Array.from(byVendor.values()).map((v) => {
    const baseLiquida = Math.max(0, v.cache - v.equipe - v.van);
    const comissaoVendedor = round2(baseLiquida * COMMISSION_RATE);
    const comissaoDescontada = round2(v.cache * COMMISSION_RATE);
    const saldo = round2(comissaoDescontada - comissaoVendedor);
    return {
      closing_id: closingId,
      artist_id: closing.artist_id,
      vendedor_id: null,
      vendedor_nome: v.vendedor,
      comissao_descontada: comissaoDescontada,
      comissao_vendedor: comissaoVendedor,
      saldo_produtora: saldo,
    };
  });

  if (rows.length > 0) {
    await supabase.from("producer_commission_balance" as any).insert(rows as any);
  }
}
