export type ShowStatus =
  | "pendente"
  | "rejeitada"
  | "aguardando_dados"
  | "aguardando_contratante"
  | "aguardando_pagamento"
  | "comprovante_enviado"
  | "confirmado"
  | "cancelada"
  | "aprovada"; // legado

export const STATUS_LABEL: Record<ShowStatus, string> = {
  pendente: "Pendente",
  rejeitada: "Rejeitada",
  aguardando_dados: "Aguardando Dados",
  aguardando_contratante: "Aguardando Contratante",
  aguardando_pagamento: "Aguardando Pagamento",
  comprovante_enviado: "Comprovante Enviado — Aguardando Confirmação",
  confirmado: "CONFIRMADO",
  cancelada: "CANCELADO",
  aprovada: "Aprovada",
};

// classes tailwind (cores fixas pedidas pelo cliente)
export const STATUS_CLASS: Record<ShowStatus, string> = {
  pendente: "bg-muted text-muted-foreground",
  rejeitada: "bg-red-600 hover:bg-red-600 text-white",
  aguardando_dados: "bg-blue-600 hover:bg-blue-600 text-white",
  aguardando_contratante: "bg-sky-400 hover:bg-sky-400 text-white",
  aguardando_pagamento: "bg-yellow-500 hover:bg-yellow-500 text-white",
  comprovante_enviado: "bg-orange-500 hover:bg-orange-500 text-white",
  confirmado: "bg-green-600 hover:bg-green-600 text-white",
  cancelada: "bg-red-800 hover:bg-red-800 text-white",
  aprovada: "bg-green-600 hover:bg-green-600 text-white",
};
