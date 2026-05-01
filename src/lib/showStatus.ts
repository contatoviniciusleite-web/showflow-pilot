export type ShowStatus =
  | "pendente"
  | "aguardando_pagamento"
  | "comprovante_enviado"
  | "confirmado"
  | "cancelada"
  | "aprovada"; // legado

export const STATUS_LABEL: Record<ShowStatus, string> = {
  pendente: "Pendente",
  aguardando_pagamento: "Aguardando Pagamento",
  comprovante_enviado: "Comprovante Enviado — Aguardando Confirmação",
  confirmado: "CONFIRMADO",
  cancelada: "CANCELADO",
  aprovada: "Aprovada",
};

// classes tailwind (cores fixas pedidas pelo cliente: amarelo/laranja/vermelho/verde)
export const STATUS_CLASS: Record<ShowStatus, string> = {
  pendente: "bg-muted text-muted-foreground",
  aguardando_pagamento: "bg-yellow-500 hover:bg-yellow-500 text-white",
  comprovante_enviado: "bg-orange-500 hover:bg-orange-500 text-white",
  confirmado: "bg-green-600 hover:bg-green-600 text-white",
  cancelada: "bg-red-600 hover:bg-red-600 text-white",
  aprovada: "bg-green-600 hover:bg-green-600 text-white",
};
