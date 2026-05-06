export type ShowStatus =
  | "pendente"
  | "aprovada"
  | "aguardando_pagamento"
  | "confirmado"
  | "cancelada"
  | "rejeitada" // estado temporário (vendedor pode corrigir e reenviar)
  // legados (mantidos por segurança no enum do banco)
  | "aguardando_dados"
  | "aguardando_contratante"
  | "comprovante_enviado";

export const STATUS_LABEL: Record<ShowStatus, string> = {
  pendente: "Pendente",
  aprovada: "Aprovada",
  aguardando_pagamento: "Aguardando Pagamento",
  confirmado: "Confirmado",
  cancelada: "Cancelado",
  rejeitada: "Rejeitada",
  aguardando_dados: "Aprovada",
  aguardando_contratante: "Aprovada",
  comprovante_enviado: "Aguardando Pagamento",
};

// classes tailwind (cores: cinza, azul, amarelo, verde, vermelho)
export const STATUS_CLASS: Record<ShowStatus, string> = {
  pendente: "bg-muted text-muted-foreground",
  aprovada: "bg-blue-600 hover:bg-blue-600 text-white",
  aguardando_pagamento: "bg-yellow-500 hover:bg-yellow-500 text-white",
  confirmado: "bg-green-600 hover:bg-green-600 text-white",
  cancelada: "bg-red-600 hover:bg-red-600 text-white",
  rejeitada: "bg-red-500 hover:bg-red-500 text-white",
  aguardando_dados: "bg-blue-600 hover:bg-blue-600 text-white",
  aguardando_contratante: "bg-blue-600 hover:bg-blue-600 text-white",
  comprovante_enviado: "bg-yellow-500 hover:bg-yellow-500 text-white",
};

// Mapa de status legados → status atuais, para normalizar exibição/filtros
export function normalizeStatus(s: string): ShowStatus {
  if (s === "aguardando_dados" || s === "aguardando_contratante") return "aprovada";
  if (s === "comprovante_enviado") return "aguardando_pagamento";
  return s as ShowStatus;
}
