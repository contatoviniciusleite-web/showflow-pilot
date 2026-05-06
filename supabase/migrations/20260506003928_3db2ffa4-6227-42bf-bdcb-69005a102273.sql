
-- ============ FORNECEDORES ============
CREATE TABLE public.fornecedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'Outros',
  telefone text,
  chave_pix text,
  banco text,
  agencia text,
  conta text,
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem fornecedores"
  ON public.fornecedores FOR SELECT TO authenticated USING (true);

CREATE POLICY "Diretor/Financeiro gerenciam fornecedores"
  ON public.fornecedores FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'diretor'::app_role) OR public.has_role(auth.uid(), 'financeiro'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'diretor'::app_role) OR public.has_role(auth.uid(), 'financeiro'::app_role));

CREATE TRIGGER set_fornecedores_updated_at
  BEFORE UPDATE ON public.fornecedores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ COLUNA FORNECEDOR EM DESPESAS DO FECHAMENTO ============
ALTER TABLE public.weekly_closing_expenses
  ADD COLUMN fornecedor_id uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL;

-- ============ PAYMENT ORDERS ============
CREATE TABLE public.payment_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  closing_id uuid NOT NULL REFERENCES public.weekly_closings(id) ON DELETE CASCADE,
  artist_id uuid NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  beneficiario_nome text NOT NULL,
  beneficiario_id uuid,
  descricao text NOT NULL,
  valor numeric(15,2) NOT NULL DEFAULT 0,
  data_sugerida date NOT NULL,
  data_pagamento date,
  status text NOT NULL DEFAULT 'pendente',
  forma_pagamento text,
  valor_pago numeric(15,2),
  comprovante_path text,
  pago_por uuid,
  pago_em timestamptz,
  motivo_cancelamento text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_orders_closing ON public.payment_orders(closing_id);
CREATE INDEX idx_payment_orders_artist ON public.payment_orders(artist_id);
CREATE INDEX idx_payment_orders_status ON public.payment_orders(status);
CREATE INDEX idx_payment_orders_data_sugerida ON public.payment_orders(data_sugerida);

ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Diretor/Financeiro veem ordens"
  ON public.payment_orders FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'diretor'::app_role) OR public.has_role(auth.uid(), 'financeiro'::app_role));

CREATE POLICY "Beneficiário vê próprias ordens pagas"
  ON public.payment_orders FOR SELECT TO authenticated
  USING (beneficiario_id = auth.uid() AND status = 'pago');

CREATE POLICY "Financeiro gerencia ordens"
  ON public.payment_orders FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'financeiro'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'financeiro'::app_role));

CREATE TRIGGER set_payment_orders_updated_at
  BEFORE UPDATE ON public.payment_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ STORAGE BUCKET COMPROVANTES ============
INSERT INTO storage.buckets (id, name, public)
VALUES ('comprovantes-pagamentos', 'comprovantes-pagamentos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Diretor/Financeiro veem comprovantes pagamento"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'comprovantes-pagamentos'
    AND (public.has_role(auth.uid(), 'diretor'::app_role) OR public.has_role(auth.uid(), 'financeiro'::app_role))
  );

CREATE POLICY "Financeiro envia comprovantes pagamento"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'comprovantes-pagamentos'
    AND public.has_role(auth.uid(), 'financeiro'::app_role)
  );

CREATE POLICY "Financeiro exclui comprovantes pagamento"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'comprovantes-pagamentos'
    AND public.has_role(auth.uid(), 'financeiro'::app_role)
  );
