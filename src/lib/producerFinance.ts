// Helpers do Financeiro da Produtora
export const REVENUE_TYPES = [
  { value: "streaming", label: "Streaming", icon: "🎵", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { value: "patrocinio", label: "Patrocínio", icon: "🤝", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "merch", label: "Merchandising", icon: "👕", color: "bg-orange-100 text-orange-700 border-orange-200" },
  { value: "licenciamento", label: "Licenciamento", icon: "🎼", color: "bg-purple-100 text-purple-700 border-purple-200" },
  { value: "evento", label: "Evento próprio", icon: "🎪", color: "bg-red-100 text-red-700 border-red-200" },
  { value: "comissao_shows", label: "Comissão shows", icon: "💼", color: "bg-gray-100 text-gray-700 border-gray-200" },
  { value: "clipe", label: "Clipe", icon: "🎬", color: "bg-pink-100 text-pink-700 border-pink-200" },
  { value: "outro", label: "Outro", icon: "💰", color: "bg-gray-100 text-gray-700 border-gray-200" },
] as const;

export const STREAMING_PLATFORMS = [
  "Spotify", "YouTube", "Deezer", "TikTok", "Apple Music", "Amazon Music", "Outros",
] as const;

export const SPONSORSHIP_TYPES = [
  "Contrato de imagem", "Post patrocinado", "Evento", "Campanha", "Outro",
] as const;

export const MERCH_PRODUCT_TYPES = [
  "Camiseta", "Boné", "Acessório", "Kit", "Outros",
] as const;

export const MERCH_CHANNELS = [
  "Show", "Loja online", "Distribuidora", "Outros",
] as const;

export const LICENSE_TYPES = [
  "Novela", "Filme", "Série", "Publicidade", "Jogo", "Outros",
] as const;

export const EVENT_REVENUE_TYPES = [
  "Bilheteria", "Patrocínio do evento", "Bar", "Outros",
] as const;

export const EXPENSE_CATEGORIES = [
  { value: "aluguel", label: "Aluguel", icon: "🏢" },
  { value: "funcionario", label: "Funcionário", icon: "👤" },
  { value: "internet", label: "Internet", icon: "📡" },
  { value: "telefone", label: "Telefone", icon: "📞" },
  { value: "assinatura", label: "Assinatura", icon: "💳" },
  { value: "servico", label: "Serviço", icon: "🔧" },
  { value: "outro", label: "Outro", icon: "📋" },
] as const;

export function revenueMeta(tipo: string) {
  return REVENUE_TYPES.find((t) => t.value === tipo) ?? REVENUE_TYPES[REVENUE_TYPES.length - 1];
}
export function expenseMeta(cat: string) {
  return EXPENSE_CATEGORIES.find((t) => t.value === cat) ?? EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1];
}

export const fmtBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n || 0));

export const monthRefOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
export const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
export const startOfYear = (d: Date) => new Date(d.getFullYear(), 0, 1);

export type PeriodPreset = "month" | "3months" | "year" | "custom";
export function rangeForPreset(p: PeriodPreset, custom?: { from: Date; to: Date }): { from: Date; to: Date } {
  const now = new Date();
  if (p === "month") return { from: startOfMonth(now), to: endOfMonth(now) };
  if (p === "3months") {
    const from = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    return { from, to: endOfMonth(now) };
  }
  if (p === "year") return { from: startOfYear(now), to: endOfMonth(now) };
  return custom ?? { from: startOfMonth(now), to: endOfMonth(now) };
}
