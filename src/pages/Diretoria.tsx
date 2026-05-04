import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, Crown } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ShowRow {
  id: string;
  status: string;
  data_show: string;
  cache_total: number | null;
  artist_id: string | null;
  created_by: string | null;
  vendedor: string | null;
  local: string | null;
  cidade: string | null;
  rejeitada_motivo: string | null;
  cancelado_motivo: string | null;
}
interface PaymentRow { show_id: string; valor: number }
interface ArtistRow { id: string; nome: string }
interface ProfileRow { id: string; nome: string | null }

const fmtBRL = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Diretoria() {
  const [loading, setLoading] = useState(true);
  const [shows, setShows] = useState<ShowRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [artists, setArtists] = useState<ArtistRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [s, p, a, pr] = await Promise.all([
        supabase.from("shows").select("id,status,data_show,cache_total,artist_id,created_by,vendedor,local,cidade,rejeitada_motivo,cancelado_motivo").order("data_show", { ascending: false }),
        supabase.from("show_payments").select("show_id,valor"),
        supabase.from("artists").select("id,nome"),
        supabase.from("profiles").select("id,nome"),
      ]);
      setShows((s.data ?? []) as ShowRow[]);
      setPayments((p.data ?? []) as PaymentRow[]);
      setArtists((a.data ?? []) as ArtistRow[]);
      setProfiles((pr.data ?? []) as ProfileRow[]);
      setLoading(false);
    })();
  }, []);

  const artistName = (id: string | null) => artists.find((x) => x.id === id)?.nome ?? "—";
  const profileName = (id: string | null) => profiles.find((x) => x.id === id)?.nome ?? "—";

  const ativos = useMemo(() => shows.filter((s) => s.status !== "cancelada" && s.status !== "rejeitada"), [shows]);

  // Visão financeira consolidada
  const financialSummary = useMemo(() => {
    const cacheTotal = ativos.reduce((acc, s) => acc + Number(s.cache_total ?? 0), 0);
    const pagoMap = new Map<string, number>();
    for (const p of payments) {
      pagoMap.set(p.show_id, (pagoMap.get(p.show_id) ?? 0) + Number(p.valor ?? 0));
    }
    const pago = ativos.reduce((acc, s) => acc + (pagoMap.get(s.id) ?? 0), 0);
    return {
      shows: ativos.length,
      cacheTotal,
      pago,
      saldo: cacheTotal - pago,
      confirmados: ativos.filter((s) => s.status === "confirmado").length,
    };
  }, [ativos, payments]);

  // Performance por artista
  const artistPerf = useMemo(() => {
    const map = new Map<string, { id: string; nome: string; shows: number; cache: number; ticket: number }>();
    for (const s of ativos) {
      if (!s.artist_id) continue;
      const cur = map.get(s.artist_id) ?? { id: s.artist_id, nome: artistName(s.artist_id), shows: 0, cache: 0, ticket: 0 };
      cur.shows += 1;
      cur.cache += Number(s.cache_total ?? 0);
      map.set(s.artist_id, cur);
    }
    const arr = Array.from(map.values()).map((x) => ({ ...x, ticket: x.shows ? x.cache / x.shows : 0 }));
    return arr.sort((a, b) => b.cache - a.cache);
  }, [ativos, artists]);

  // Performance por vendedor
  const vendedorPerf = useMemo(() => {
    const map = new Map<string, { id: string; nome: string; total: number; aprovadas: number; rejeitadas: number; canceladas: number; cache: number }>();
    for (const s of shows) {
      if (!s.created_by) continue;
      const cur = map.get(s.created_by) ?? { id: s.created_by, nome: profileName(s.created_by), total: 0, aprovadas: 0, rejeitadas: 0, canceladas: 0, cache: 0 };
      cur.total += 1;
      if (s.status === "rejeitada") cur.rejeitadas += 1;
      else if (s.status === "cancelada") cur.canceladas += 1;
      else { cur.aprovadas += 1; cur.cache += Number(s.cache_total ?? 0); }
      map.set(s.created_by, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.cache - a.cache);
  }, [shows, profiles]);

  const aprovadas = useMemo(() => shows.filter((s) => !["pendente", "rejeitada", "cancelada"].includes(s.status)), [shows]);
  const rejeitadas = useMemo(() => shows.filter((s) => s.status === "rejeitada"), [shows]);
  const canceladas = useMemo(() => shows.filter((s) => s.status === "cancelada"), [shows]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Crown className="h-7 w-7 text-accent" />
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold">Diretoria</h1>
          <p className="text-muted-foreground mt-1">Visão executiva consolidada da produtora.</p>
        </div>
      </div>

      <Tabs defaultValue="financeiro">
        <TabsList>
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          <TabsTrigger value="artistas">Artistas</TabsTrigger>
          <TabsTrigger value="vendedores">Vendedores</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="financeiro" className="space-y-4">
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
            <Card className="p-4"><p className="text-xs text-muted-foreground">Shows ativos</p><p className="text-2xl font-semibold">{financialSummary.shows}</p></Card>
            <Card className="p-4"><p className="text-xs text-muted-foreground">Cachê total</p><p className="text-2xl font-semibold">{fmtBRL(financialSummary.cacheTotal)}</p></Card>
            <Card className="p-4"><p className="text-xs text-muted-foreground">Pago</p><p className="text-2xl font-semibold text-emerald-600">{fmtBRL(financialSummary.pago)}</p></Card>
            <Card className="p-4"><p className="text-xs text-muted-foreground">Saldo a receber</p><p className="text-2xl font-semibold">{fmtBRL(financialSummary.saldo)}</p></Card>
          </div>
        </TabsContent>

        <TabsContent value="artistas">
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-4 py-3">Artista</th>
                  <th className="text-right font-medium px-4 py-3">Shows</th>
                  <th className="text-right font-medium px-4 py-3">Faturamento</th>
                  <th className="text-right font-medium px-4 py-3">Ticket médio</th>
                </tr>
              </thead>
              <tbody>
                {artistPerf.map((a) => (
                  <tr key={a.id} className="border-t">
                    <td className="px-4 py-3">{a.nome}</td>
                    <td className="px-4 py-3 text-right">{a.shows}</td>
                    <td className="px-4 py-3 text-right">{fmtBRL(a.cache)}</td>
                    <td className="px-4 py-3 text-right">{fmtBRL(a.ticket)}</td>
                  </tr>
                ))}
                {artistPerf.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Sem dados.</td></tr>}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        <TabsContent value="vendedores">
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-4 py-3">Vendedor</th>
                  <th className="text-right font-medium px-4 py-3">Minutas</th>
                  <th className="text-right font-medium px-4 py-3">Aprovadas</th>
                  <th className="text-right font-medium px-4 py-3">Rejeitadas</th>
                  <th className="text-right font-medium px-4 py-3">Canceladas</th>
                  <th className="text-right font-medium px-4 py-3">Faturamento</th>
                </tr>
              </thead>
              <tbody>
                {vendedorPerf.map((v) => (
                  <tr key={v.id} className="border-t">
                    <td className="px-4 py-3">{v.nome}</td>
                    <td className="px-4 py-3 text-right">{v.total}</td>
                    <td className="px-4 py-3 text-right text-emerald-600">{v.aprovadas}</td>
                    <td className="px-4 py-3 text-right text-destructive">{v.rejeitadas}</td>
                    <td className="px-4 py-3 text-right">{v.canceladas}</td>
                    <td className="px-4 py-3 text-right">{fmtBRL(v.cache)}</td>
                  </tr>
                ))}
                {vendedorPerf.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Sem dados.</td></tr>}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        <TabsContent value="historico" className="space-y-4">
          <HistorySection title="Aprovados / Em andamento" rows={aprovadas} variant="ok" artistName={artistName} />
          <HistorySection title="Rejeitados" rows={rejeitadas} variant="reject" artistName={artistName} />
          <HistorySection title="Cancelados" rows={canceladas} variant="cancel" artistName={artistName} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function HistorySection({
  title, rows, variant, artistName,
}: { title: string; rows: ShowRow[]; variant: "ok" | "reject" | "cancel"; artistName: (id: string | null) => string }) {
  return (
    <Card className="overflow-x-auto">
      <div className="px-4 py-3 border-b flex items-center gap-2">
        <h3 className="font-medium">{title}</h3>
        <Badge variant="secondary">{rows.length}</Badge>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-muted-foreground">
          <tr>
            <th className="text-left font-medium px-4 py-2">Data</th>
            <th className="text-left font-medium px-4 py-2">Artista</th>
            <th className="text-left font-medium px-4 py-2">Local</th>
            <th className="text-left font-medium px-4 py-2">Status</th>
            {variant !== "ok" && <th className="text-left font-medium px-4 py-2">Motivo</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id} className="border-t">
              <td className="px-4 py-2">{format(new Date(s.data_show + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })}</td>
              <td className="px-4 py-2">{artistName(s.artist_id)}</td>
              <td className="px-4 py-2 text-muted-foreground">{[s.local, s.cidade].filter(Boolean).join(" · ") || "—"}</td>
              <td className="px-4 py-2"><Badge variant="secondary">{s.status}</Badge></td>
              {variant !== "ok" && (
                <td className="px-4 py-2 text-muted-foreground">
                  {variant === "reject" ? s.rejeitada_motivo : s.cancelado_motivo}
                </td>
              )}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={variant === "ok" ? 4 : 5} className="px-4 py-8 text-center text-muted-foreground">Sem registros.</td></tr>
          )}
        </tbody>
      </table>
    </Card>
  );
}
