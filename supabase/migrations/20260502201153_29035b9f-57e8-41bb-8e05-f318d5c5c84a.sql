-- 1) shows: snapshot do nome de quem confirmou
ALTER TABLE public.shows ADD COLUMN IF NOT EXISTS confirmado_por_nome text;

-- 2) notifications: ampliar tipos permitidos
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_tipo_check;
ALTER TABLE public.notifications
ADD CONSTRAINT notifications_tipo_check
CHECK (tipo = ANY (ARRAY[
  'minuta_aprovada','minuta_rejeitada','comprovante_enviado','comprovante_recebido',
  'show_confirmado','show_cancelado','show_remarcado','aviso_prazo','auto_aprovado',
  'pagamento_confirmado','pagamento_registrado','data_bloqueada','anexo_adicionado'
]::text[]));

-- 3) show_attachments: múltiplos comprovantes/anexos por show
CREATE TABLE IF NOT EXISTS public.show_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id uuid NOT NULL,
  tipo text NOT NULL DEFAULT 'comprovante',
  file_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  size_bytes integer,
  uploaded_by uuid NOT NULL,
  uploaded_by_nome text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_show_attachments_show_id ON public.show_attachments(show_id, created_at DESC);

ALTER TABLE public.show_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ver anexos conforme papel" ON public.show_attachments;
CREATE POLICY "Ver anexos conforme papel" ON public.show_attachments
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'gerente'::app_role)
  OR has_role(auth.uid(), 'financeiro'::app_role)
  OR has_role(auth.uid(), 'equipe'::app_role)
  OR (uploaded_by = auth.uid())
);

DROP POLICY IF EXISTS "Inserir anexos conforme papel" ON public.show_attachments;
CREATE POLICY "Inserir anexos conforme papel" ON public.show_attachments
FOR INSERT TO authenticated
WITH CHECK (
  uploaded_by = auth.uid() AND (
    has_role(auth.uid(), 'gerente'::app_role)
    OR has_role(auth.uid(), 'financeiro'::app_role)
    OR has_role(auth.uid(), 'equipe'::app_role)
    OR EXISTS (SELECT 1 FROM public.shows s WHERE s.id = show_id AND s.created_by = auth.uid())
  )
);

DROP POLICY IF EXISTS "Excluir anexos (gerente/financeiro)" ON public.show_attachments;
CREATE POLICY "Excluir anexos (gerente/financeiro)" ON public.show_attachments
FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'gerente'::app_role)
  OR has_role(auth.uid(), 'financeiro'::app_role)
);

-- 4) show_payments: baixas de pagamento (manuais ou via comprovante)
CREATE TABLE IF NOT EXISTS public.show_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id uuid NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  data_pagamento date NOT NULL,
  forma_pagamento text NOT NULL DEFAULT 'pix',
  conta_destino text,
  observacoes text,
  attachment_id uuid REFERENCES public.show_attachments(id) ON DELETE SET NULL,
  registrado_por uuid NOT NULL,
  registrado_por_nome text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_show_payments_show_id ON public.show_payments(show_id, created_at DESC);
ALTER TABLE public.show_payments
  DROP CONSTRAINT IF EXISTS show_payments_forma_check;
ALTER TABLE public.show_payments
  ADD CONSTRAINT show_payments_forma_check
  CHECK (forma_pagamento IN ('pix','transferencia','especie','outro'));

ALTER TABLE public.show_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ver pagamentos conforme papel" ON public.show_payments;
CREATE POLICY "Ver pagamentos conforme papel" ON public.show_payments
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'gerente'::app_role)
  OR has_role(auth.uid(), 'equipe'::app_role)
  OR has_role(auth.uid(), 'financeiro'::app_role)
  OR EXISTS (SELECT 1 FROM public.shows s WHERE s.id = show_id AND s.created_by = auth.uid())
);

DROP POLICY IF EXISTS "Financeiro gerencia pagamentos" ON public.show_payments;
CREATE POLICY "Financeiro gerencia pagamentos" ON public.show_payments
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'financeiro'::app_role))
WITH CHECK (has_role(auth.uid(), 'financeiro'::app_role));

-- 5) Storage: permitir delete por gerência/financeiro continua via can_manage_comprovantes; nada a alterar.