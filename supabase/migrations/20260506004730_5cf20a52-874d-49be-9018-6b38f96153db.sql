-- ============ producer_revenues ============
CREATE TABLE public.producer_revenues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,
  descricao text NOT NULL,
  artist_id uuid REFERENCES public.artists(id) ON DELETE SET NULL,
  valor numeric(15,2) NOT NULL DEFAULT 0,
  data_recebimento date NOT NULL,
  distribuidora text,
  periodo_referencia text,
  comprovante_path text,
  recorrente boolean NOT NULL DEFAULT false,
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.producer_revenues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Diretor/Financeiro veem receitas produtora"
  ON public.producer_revenues FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'diretor'::app_role) OR has_role(auth.uid(),'financeiro'::app_role));

CREATE POLICY "Financeiro gerencia receitas produtora"
  ON public.producer_revenues FOR ALL TO authenticated
  USING (has_role(auth.uid(),'financeiro'::app_role))
  WITH CHECK (has_role(auth.uid(),'financeiro'::app_role));

CREATE TRIGGER trg_producer_revenues_updated
  BEFORE UPDATE ON public.producer_revenues
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ producer_recurring_revenues ============
CREATE TABLE public.producer_recurring_revenues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,
  descricao text NOT NULL,
  artist_id uuid REFERENCES public.artists(id) ON DELETE SET NULL,
  valor numeric(15,2) NOT NULL DEFAULT 0,
  distribuidora text,
  dia_recebimento integer,
  ativo boolean NOT NULL DEFAULT true,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.producer_recurring_revenues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Diretor/Financeiro veem receitas recorrentes"
  ON public.producer_recurring_revenues FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'diretor'::app_role) OR has_role(auth.uid(),'financeiro'::app_role));

CREATE POLICY "Financeiro gerencia receitas recorrentes"
  ON public.producer_recurring_revenues FOR ALL TO authenticated
  USING (has_role(auth.uid(),'financeiro'::app_role))
  WITH CHECK (has_role(auth.uid(),'financeiro'::app_role));

CREATE TRIGGER trg_producer_recurring_revenues_updated
  BEFORE UPDATE ON public.producer_recurring_revenues
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ producer_expenses ============
CREATE TABLE public.producer_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria text NOT NULL,
  descricao text NOT NULL,
  beneficiario text,
  valor numeric(15,2) NOT NULL DEFAULT 0,
  recorrente boolean NOT NULL DEFAULT false,
  recurring_id uuid,
  dia_vencimento integer,
  data_vencimento date,
  status text NOT NULL DEFAULT 'pendente',
  forma_pagamento text,
  valor_pago numeric(15,2),
  comprovante_path text,
  pago_por uuid,
  pago_em timestamptz,
  cancelado_motivo text,
  mes_referencia text NOT NULL,
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.producer_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Diretor/Financeiro veem despesas produtora"
  ON public.producer_expenses FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'diretor'::app_role) OR has_role(auth.uid(),'financeiro'::app_role));

CREATE POLICY "Financeiro gerencia despesas produtora"
  ON public.producer_expenses FOR ALL TO authenticated
  USING (has_role(auth.uid(),'financeiro'::app_role))
  WITH CHECK (has_role(auth.uid(),'financeiro'::app_role));

CREATE TRIGGER trg_producer_expenses_updated
  BEFORE UPDATE ON public.producer_expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ producer_recurring_expenses ============
CREATE TABLE public.producer_recurring_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria text NOT NULL,
  descricao text NOT NULL,
  beneficiario text,
  valor numeric(15,2) NOT NULL DEFAULT 0,
  dia_vencimento integer NOT NULL,
  forma_pagamento_padrao text,
  ativo boolean NOT NULL DEFAULT true,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.producer_recurring_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Diretor/Financeiro veem desp recorrentes"
  ON public.producer_recurring_expenses FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'diretor'::app_role) OR has_role(auth.uid(),'financeiro'::app_role));

CREATE POLICY "Financeiro gerencia desp recorrentes"
  ON public.producer_recurring_expenses FOR ALL TO authenticated
  USING (has_role(auth.uid(),'financeiro'::app_role))
  WITH CHECK (has_role(auth.uid(),'financeiro'::app_role));

CREATE TRIGGER trg_producer_recurring_expenses_updated
  BEFORE UPDATE ON public.producer_recurring_expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.producer_expenses
  ADD CONSTRAINT producer_expenses_recurring_fk
  FOREIGN KEY (recurring_id) REFERENCES public.producer_recurring_expenses(id) ON DELETE SET NULL;

-- ============ producer_commission_balance ============
CREATE TABLE public.producer_commission_balance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  closing_id uuid NOT NULL REFERENCES public.weekly_closings(id) ON DELETE CASCADE,
  artist_id uuid NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  vendedor_id uuid,
  vendedor_nome text,
  comissao_descontada numeric(15,2) NOT NULL DEFAULT 0,
  comissao_vendedor numeric(15,2) NOT NULL DEFAULT 0,
  saldo_produtora numeric(15,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pcb_closing ON public.producer_commission_balance(closing_id);
ALTER TABLE public.producer_commission_balance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Diretor/Financeiro veem comissao produtora"
  ON public.producer_commission_balance FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'diretor'::app_role) OR has_role(auth.uid(),'financeiro'::app_role));

CREATE POLICY "Financeiro gerencia comissao produtora"
  ON public.producer_commission_balance FOR ALL TO authenticated
  USING (has_role(auth.uid(),'financeiro'::app_role))
  WITH CHECK (has_role(auth.uid(),'financeiro'::app_role));

-- ============ Storage bucket ============
INSERT INTO storage.buckets (id, name, public)
VALUES ('financeiro-produtora','financeiro-produtora', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Financeiro gerencia bucket financeiro-produtora"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'financeiro-produtora' AND has_role(auth.uid(),'financeiro'::app_role))
  WITH CHECK (bucket_id = 'financeiro-produtora' AND has_role(auth.uid(),'financeiro'::app_role));

CREATE POLICY "Diretor le bucket financeiro-produtora"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'financeiro-produtora' AND (has_role(auth.uid(),'diretor'::app_role) OR has_role(auth.uid(),'financeiro'::app_role)));