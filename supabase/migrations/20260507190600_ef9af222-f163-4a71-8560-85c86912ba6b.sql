ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_tipo_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_tipo_check CHECK (tipo = ANY (ARRAY[
  'minuta_pendente','minuta_aprovada','minuta_rejeitada','comprovante_enviado','comprovante_recebido',
  'show_confirmado','show_cancelado','show_remarcado','aviso_prazo','auto_aprovado',
  'pagamento_confirmado','pagamento_registrado','baixa_estornada','data_bloqueada',
  'anexo_adicionado','dados_completos','show_confirmado_sem_pagamento','fechamento_finalizado'
]));