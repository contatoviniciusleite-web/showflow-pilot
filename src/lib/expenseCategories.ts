// Catálogo hierárquico de categorias/subcategorias de despesas da produtora.
// Fonte de verdade para o módulo de despesas.

export type ExpenseCategoryKey =
  | "funcionamento"
  | "equipe"
  | "marketing"
  | "producao_musical"
  | "videoclipe"
  | "equipamento"
  | "figurino"
  | "viagem"
  | "juridico";

export type ExpenseCategoryDef = {
  value: ExpenseCategoryKey;
  label: string;
  icon: string;
  /** Classe Tailwind para badge (cores semânticas / utilitárias). */
  badgeClass: string;
  subcategorias: { value: string; label: string }[];
};

export const EXPENSE_CATEGORIES_V2: ExpenseCategoryDef[] = [
  {
    value: "funcionamento",
    label: "Funcionamento",
    icon: "🏢",
    badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
    subcategorias: [
      { value: "aluguel", label: "Aluguel" },
      { value: "internet", label: "Internet" },
      { value: "telefone", label: "Telefone" },
      { value: "agua", label: "Água" },
      { value: "luz", label: "Luz / Energia" },
      { value: "assinatura_software", label: "Assinatura de software" },
      { value: "outros", label: "Outros" },
    ],
  },
  {
    value: "equipe",
    label: "Equipe",
    icon: "👤",
    badgeClass: "bg-blue-100 text-blue-700 border-blue-200",
    subcategorias: [
      { value: "clt", label: "Funcionário CLT" },
      { value: "pj", label: "Prestador de Serviço (PJ)" },
      { value: "freelancer", label: "Freelancer" },
      { value: "pro_labore", label: "Pró-labore" },
      { value: "outros", label: "Outros" },
    ],
  },
  {
    value: "marketing",
    label: "Marketing",
    icon: "📣",
    badgeClass: "bg-orange-100 text-orange-700 border-orange-200",
    subcategorias: [
      { value: "trafego_pago", label: "Tráfego pago (Meta / Google Ads)" },
      { value: "assessoria", label: "Assessoria de imprensa" },
      { value: "midia", label: "Mídia e publicidade" },
      { value: "influencer", label: "Influencer / Creator" },
      { value: "design", label: "Design gráfico" },
      { value: "redes_sociais", label: "Gestão de redes sociais" },
      { value: "outros", label: "Outros" },
    ],
  },
  {
    value: "producao_musical",
    label: "Produção musical",
    icon: "🎵",
    badgeClass: "bg-purple-100 text-purple-700 border-purple-200",
    subcategorias: [
      { value: "estudio", label: "Estúdio de gravação" },
      { value: "masterizacao", label: "Masterização" },
      { value: "mixagem", label: "Mixagem" },
      { value: "distribuicao", label: "Distribuição digital" },
      { value: "ecad", label: "Direitos autorais / ECAD" },
      { value: "composicao", label: "Composição / Letra" },
      { value: "outros", label: "Outros" },
    ],
  },
  {
    value: "videoclipe",
    label: "Videoclipe",
    icon: "🎬",
    badgeClass: "bg-pink-100 text-pink-700 border-pink-200",
    subcategorias: [
      { value: "direcao", label: "Direção" },
      { value: "equipe_tecnica", label: "Equipe técnica (câmera, luz, som)" },
      { value: "locacao", label: "Locação" },
      { value: "edicao", label: "Edição e pós-produção" },
      { value: "atores", label: "Atores / Figurantes" },
      { value: "figurino_clipe", label: "Figurino do clipe" },
      { value: "outros", label: "Outros" },
    ],
  },
  {
    value: "equipamento",
    label: "Equipamento",
    icon: "🔧",
    badgeClass: "bg-zinc-200 text-zinc-800 border-zinc-300",
    subcategorias: [
      { value: "instrumento", label: "Instrumento musical" },
      { value: "som", label: "Equipamento de som" },
      { value: "iluminacao", label: "Equipamento de iluminação" },
      { value: "video", label: "Câmera / Equipamento de vídeo" },
      { value: "acessorios", label: "Acessórios" },
      { value: "manutencao", label: "Manutenção / Reparo" },
      { value: "outros", label: "Outros" },
    ],
  },
  {
    value: "figurino",
    label: "Figurino e imagem",
    icon: "👗",
    badgeClass: "bg-rose-100 text-rose-700 border-rose-200",
    subcategorias: [
      { value: "roupas", label: "Roupas e acessórios" },
      { value: "maquiagem", label: "Maquiagem e cabelo" },
      { value: "fotografia", label: "Fotografia profissional" },
      { value: "identidade_visual", label: "Identidade visual" },
      { value: "outros", label: "Outros" },
    ],
  },
  {
    value: "viagem",
    label: "Viagem e logística",
    icon: "✈️",
    badgeClass: "bg-sky-100 text-sky-700 border-sky-200",
    subcategorias: [
      { value: "aereo", label: "Passagem aérea" },
      { value: "terrestre", label: "Passagem terrestre" },
      { value: "hospedagem", label: "Hospedagem" },
      { value: "van", label: "Van / Transporte" },
      { value: "uber", label: "Uber / Taxi" },
      { value: "alimentacao", label: "Alimentação em viagem" },
      { value: "outros", label: "Outros" },
    ],
  },
  {
    value: "juridico",
    label: "Jurídico e contábil",
    icon: "⚖️",
    badgeClass: "bg-amber-100 text-amber-700 border-amber-200",
    subcategorias: [
      { value: "advocaticios", label: "Honorários advocatícios" },
      { value: "contabeis", label: "Honorários contábeis" },
      { value: "marca", label: "Registro de marca" },
      { value: "taxas", label: "Taxas e impostos" },
      { value: "certidoes", label: "Certidões e documentos" },
      { value: "outros", label: "Outros" },
    ],
  },
];

export const TIPO_DESPESA_OPTIONS = [
  { value: "custo_operacional", label: "Custo operacional", badgeClass: "bg-slate-100 text-slate-700 border-slate-200" },
  { value: "investimento", label: "Investimento", badgeClass: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { value: "aporte", label: "Aporte", badgeClass: "bg-purple-100 text-purple-700 border-purple-200" },
  { value: "reembolso", label: "Reembolso", badgeClass: "bg-orange-100 text-orange-700 border-orange-200" },
] as const;

export const CENTRO_CUSTO_OPTIONS = [
  { value: "produtora", label: "Produtora" },
  { value: "artista", label: "Artista específico" },
  { value: "marketing", label: "Marketing" },
  { value: "administrativo", label: "Administrativo" },
] as const;

export const DEPARTAMENTO_OPTIONS = [
  "Produção",
  "Comercial",
  "Financeiro",
  "Administrativo",
  "Criativo",
  "Outro",
] as const;

export const TIPO_CONTRATO_OPTIONS = ["CLT", "PJ", "Freelancer"] as const;

export const TIPO_CONTA_OPTIONS = ["Corrente", "Poupança"] as const;

export const TIPO_CHAVE_PIX_OPTIONS = [
  "CPF",
  "CNPJ",
  "E-mail",
  "Telefone",
  "Aleatória",
] as const;

export const BANCOS_BR = [
  "Banco do Brasil",
  "Bradesco",
  "Itaú",
  "Santander",
  "Caixa Econômica Federal",
  "Nubank",
  "Inter",
  "C6 Bank",
  "Sicoob",
  "Sicredi",
  "Banrisul",
  "BTG Pactual",
  "Safra",
  "PicPay",
  "Mercado Pago",
  "Outro",
] as const;

export function getCategoria(value?: string | null): ExpenseCategoryDef | null {
  if (!value) return null;
  return EXPENSE_CATEGORIES_V2.find((c) => c.value === value) ?? null;
}

export function getSubcategoria(catValue?: string | null, subValue?: string | null) {
  const cat = getCategoria(catValue);
  if (!cat || !subValue) return null;
  return cat.subcategorias.find((s) => s.value === subValue) ?? null;
}

export function getTipoDespesa(value?: string | null) {
  return TIPO_DESPESA_OPTIONS.find((t) => t.value === value) ?? TIPO_DESPESA_OPTIONS[0];
}
