-- Novos campos de receita
ALTER TABLE public.producer_revenues ADD COLUMN IF NOT EXISTS subcategoria text;
ALTER TABLE public.producer_revenues ADD COLUMN IF NOT EXISTS artista_vinculo text DEFAULT 'artista';
ALTER TABLE public.producer_revenues ADD COLUMN IF NOT EXISTS plataformas jsonb;
ALTER TABLE public.producer_revenues ADD COLUMN IF NOT EXISTS nome_marca text;
ALTER TABLE public.producer_revenues ADD COLUMN IF NOT EXISTS tipo_contrato text;
ALTER TABLE public.producer_revenues ADD COLUMN IF NOT EXISTS vigencia_inicio date;
ALTER TABLE public.producer_revenues ADD COLUMN IF NOT EXISTS vigencia_fim date;
ALTER TABLE public.producer_revenues ADD COLUMN IF NOT EXISTS valor_total_contrato numeric(15,2);
ALTER TABLE public.producer_revenues ADD COLUMN IF NOT EXISTS parcela_numero integer;
ALTER TABLE public.producer_revenues ADD COLUMN IF NOT EXISTS parcela_total integer;
ALTER TABLE public.producer_revenues ADD COLUMN IF NOT EXISTS quantidade integer;
ALTER TABLE public.producer_revenues ADD COLUMN IF NOT EXISTS valor_unitario numeric(15,2);
ALTER TABLE public.producer_revenues ADD COLUMN IF NOT EXISTS canal_venda text;
ALTER TABLE public.producer_revenues ADD COLUMN IF NOT EXISTS obra_licenciada text;
ALTER TABLE public.producer_revenues ADD COLUMN IF NOT EXISTS empresa_contratante text;
ALTER TABLE public.producer_revenues ADD COLUMN IF NOT EXISTS periodo_licenca_inicio date;
ALTER TABLE public.producer_revenues ADD COLUMN IF NOT EXISTS periodo_licenca_fim date;
ALTER TABLE public.producer_revenues ADD COLUMN IF NOT EXISTS nome_evento text;
ALTER TABLE public.producer_revenues ADD COLUMN IF NOT EXISTS artistas_evento jsonb;
ALTER TABLE public.producer_revenues ADD COLUMN IF NOT EXISTS valor_bruto numeric(15,2);
ALTER TABLE public.producer_revenues ADD COLUMN IF NOT EXISTS custos_evento numeric(15,2);
ALTER TABLE public.producer_revenues ADD COLUMN IF NOT EXISTS closing_id uuid REFERENCES public.weekly_closings(id);
ALTER TABLE public.producer_revenues ADD COLUMN IF NOT EXISTS projeto text;
ALTER TABLE public.producer_revenues ADD COLUMN IF NOT EXISTS tags text;
ALTER TABLE public.producer_revenues ADD COLUMN IF NOT EXISTS status text DEFAULT 'recebido';
ALTER TABLE public.producer_revenues ADD COLUMN IF NOT EXISTS comprovante_path text;

CREATE INDEX IF NOT EXISTS producer_revenues_status_idx ON public.producer_revenues(status);
CREATE INDEX IF NOT EXISTS producer_revenues_tipo_idx ON public.producer_revenues(tipo);

-- Permitir Diretor gerenciar (além de visualizar)
DROP POLICY IF EXISTS "Diretor/Financeiro gerenciam receitas produtora" ON public.producer_revenues;
CREATE POLICY "Diretor/Financeiro gerenciam receitas produtora"
ON public.producer_revenues FOR ALL TO authenticated
USING (has_role(auth.uid(), 'diretor'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role))
WITH CHECK (has_role(auth.uid(), 'diretor'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));

DROP POLICY IF EXISTS "Diretor/Financeiro gerenciam despesas produtora" ON public.producer_expenses;
CREATE POLICY "Diretor/Financeiro gerenciam despesas produtora"
ON public.producer_expenses FOR ALL TO authenticated
USING (has_role(auth.uid(), 'diretor'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role))
WITH CHECK (has_role(auth.uid(), 'diretor'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));

DROP POLICY IF EXISTS "Diretor/Financeiro gerenciam desp recorrentes" ON public.producer_recurring_expenses;
CREATE POLICY "Diretor/Financeiro gerenciam desp recorrentes"
ON public.producer_recurring_expenses FOR ALL TO authenticated
USING (has_role(auth.uid(), 'diretor'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role))
WITH CHECK (has_role(auth.uid(), 'diretor'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));

DROP POLICY IF EXISTS "Diretor/Financeiro gerenciam receitas recorrentes" ON public.producer_recurring_revenues;
CREATE POLICY "Diretor/Financeiro gerenciam receitas recorrentes"
ON public.producer_recurring_revenues FOR ALL TO authenticated
USING (has_role(auth.uid(), 'diretor'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role))
WITH CHECK (has_role(auth.uid(), 'diretor'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));