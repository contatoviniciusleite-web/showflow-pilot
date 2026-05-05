-- Despesas operacionais por show dentro do fechamento
CREATE TABLE IF NOT EXISTS public.weekly_closing_show_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  closing_id uuid NOT NULL,
  closing_show_id uuid NOT NULL,
  categoria text NOT NULL DEFAULT 'Outros',
  descricao text,
  valor numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wcse_closing ON public.weekly_closing_show_expenses(closing_id);
CREATE INDEX IF NOT EXISTS idx_wcse_show ON public.weekly_closing_show_expenses(closing_show_id);

ALTER TABLE public.weekly_closing_show_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Financeiro gerencia despesas por show"
ON public.weekly_closing_show_expenses FOR ALL TO authenticated
USING (has_role(auth.uid(), 'financeiro'::app_role))
WITH CHECK (has_role(auth.uid(), 'financeiro'::app_role));

CREATE POLICY "Diretor/Financeiro veem despesas por show"
ON public.weekly_closing_show_expenses FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'diretor'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));

CREATE POLICY "Artista vê despesas por show do próprio fechamento finalizado"
ON public.weekly_closing_show_expenses FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'artista'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.weekly_closings wc
    WHERE wc.id = weekly_closing_show_expenses.closing_id
      AND wc.artist_id = get_my_artist_id()
      AND wc.status = 'finalizado'
  )
);

-- Investimentos cadastrados por artista (parceláveis)
CREATE TABLE IF NOT EXISTS public.artist_investments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id uuid NOT NULL,
  descricao text NOT NULL,
  categoria text NOT NULL DEFAULT 'Outros',
  valor_total numeric NOT NULL DEFAULT 0,
  total_parcelas integer NOT NULL DEFAULT 1,
  parcelas_pagas integer NOT NULL DEFAULT 0,
  valor_por_parcela numeric NOT NULL DEFAULT 0,
  closing_id_origem uuid,
  data_compra date,
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_artist ON public.artist_investments(artist_id);

ALTER TABLE public.artist_investments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Financeiro gerencia investimentos"
ON public.artist_investments FOR ALL TO authenticated
USING (has_role(auth.uid(), 'financeiro'::app_role))
WITH CHECK (has_role(auth.uid(), 'financeiro'::app_role));

CREATE POLICY "Diretor/Financeiro veem investimentos"
ON public.artist_investments FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'diretor'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));

CREATE POLICY "Artista vê próprios investimentos"
ON public.artist_investments FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'artista'::app_role) AND artist_id = get_my_artist_id());

CREATE TRIGGER trg_ai_updated BEFORE UPDATE ON public.artist_investments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Investimentos lançados em cada fechamento (parcela aplicada)
CREATE TABLE IF NOT EXISTS public.weekly_closing_investments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  closing_id uuid NOT NULL,
  investment_id uuid,
  descricao text NOT NULL,
  categoria text,
  valor_total numeric NOT NULL DEFAULT 0,
  total_parcelas integer NOT NULL DEFAULT 1,
  numero_parcela integer NOT NULL DEFAULT 1,
  valor_descontado numeric NOT NULL DEFAULT 0,
  data_compra date,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wci_closing ON public.weekly_closing_investments(closing_id);

ALTER TABLE public.weekly_closing_investments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Financeiro gerencia investimentos do fechamento"
ON public.weekly_closing_investments FOR ALL TO authenticated
USING (has_role(auth.uid(), 'financeiro'::app_role))
WITH CHECK (has_role(auth.uid(), 'financeiro'::app_role));

CREATE POLICY "Diretor/Financeiro veem investimentos do fechamento"
ON public.weekly_closing_investments FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'diretor'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));

CREATE POLICY "Artista vê investimentos do próprio fechamento finalizado"
ON public.weekly_closing_investments FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'artista'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.weekly_closings wc
    WHERE wc.id = weekly_closing_investments.closing_id
      AND wc.artist_id = get_my_artist_id()
      AND wc.status = 'finalizado'
  )
);

-- Coluna de investimento na distribuição
ALTER TABLE public.weekly_closing_distribution
  ADD COLUMN IF NOT EXISTS investimento_valor numeric NOT NULL DEFAULT 0;