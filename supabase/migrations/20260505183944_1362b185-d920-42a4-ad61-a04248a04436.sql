-- Remover acesso do perfil "gerente" ao módulo de fechamento semanal
-- Recria as policies sem incluir o role 'gerente'.

-- artist_financial_config
DROP POLICY IF EXISTS "Gerenciar config financeira (gerente/diretor)" ON public.artist_financial_config;
CREATE POLICY "Gerenciar config financeira (diretor)"
  ON public.artist_financial_config FOR ALL
  USING (public.has_role(auth.uid(), 'diretor'))
  WITH CHECK (public.has_role(auth.uid(), 'diretor'));

-- artist_partners
DROP POLICY IF EXISTS "Gerenciar sócios (gerente/diretor)" ON public.artist_partners;
CREATE POLICY "Gerenciar sócios (diretor)"
  ON public.artist_partners FOR ALL
  USING (public.has_role(auth.uid(), 'diretor'))
  WITH CHECK (public.has_role(auth.uid(), 'diretor'));

-- artist_crew
DROP POLICY IF EXISTS "Gerenciar equipe base (gerente/diretor)" ON public.artist_crew;
CREATE POLICY "Gerenciar equipe base (diretor)"
  ON public.artist_crew FOR ALL
  USING (public.has_role(auth.uid(), 'diretor'))
  WITH CHECK (public.has_role(auth.uid(), 'diretor'));

-- weekly_closings: visualização (sem gerente)
DROP POLICY IF EXISTS "Ver fechamentos (gerente/diretor/financeiro)" ON public.weekly_closings;
CREATE POLICY "Ver fechamentos (diretor/financeiro)"
  ON public.weekly_closings FOR SELECT
  USING (
    public.has_role(auth.uid(), 'diretor')
    OR public.has_role(auth.uid(), 'financeiro')
  );

DROP POLICY IF EXISTS "Gerenciar fechamentos (gerente/diretor)" ON public.weekly_closings;
CREATE POLICY "Gerenciar fechamentos (diretor)"
  ON public.weekly_closings FOR ALL
  USING (public.has_role(auth.uid(), 'diretor'))
  WITH CHECK (public.has_role(auth.uid(), 'diretor'));

-- weekly_closing_shows
DROP POLICY IF EXISTS "Ver shows do fechamento (gerente/diretor/financeiro)" ON public.weekly_closing_shows;
CREATE POLICY "Ver shows do fechamento (diretor/financeiro)"
  ON public.weekly_closing_shows FOR SELECT
  USING (
    public.has_role(auth.uid(), 'diretor')
    OR public.has_role(auth.uid(), 'financeiro')
  );

DROP POLICY IF EXISTS "Gerenciar shows do fechamento (gerente/diretor)" ON public.weekly_closing_shows;
CREATE POLICY "Gerenciar shows do fechamento (diretor)"
  ON public.weekly_closing_shows FOR ALL
  USING (public.has_role(auth.uid(), 'diretor'))
  WITH CHECK (public.has_role(auth.uid(), 'diretor'));

-- weekly_closing_crew
DROP POLICY IF EXISTS "Ver equipe do fechamento (gerente/diretor/financeiro)" ON public.weekly_closing_crew;
CREATE POLICY "Ver equipe do fechamento (diretor/financeiro)"
  ON public.weekly_closing_crew FOR SELECT
  USING (
    public.has_role(auth.uid(), 'diretor')
    OR public.has_role(auth.uid(), 'financeiro')
  );

DROP POLICY IF EXISTS "Gerenciar equipe do fechamento (gerente/diretor)" ON public.weekly_closing_crew;
CREATE POLICY "Gerenciar equipe do fechamento (diretor)"
  ON public.weekly_closing_crew FOR ALL
  USING (public.has_role(auth.uid(), 'diretor'))
  WITH CHECK (public.has_role(auth.uid(), 'diretor'));

-- weekly_closing_expenses
DROP POLICY IF EXISTS "Ver despesas do fechamento (gerente/diretor/financeiro)" ON public.weekly_closing_expenses;
CREATE POLICY "Ver despesas do fechamento (diretor/financeiro)"
  ON public.weekly_closing_expenses FOR SELECT
  USING (
    public.has_role(auth.uid(), 'diretor')
    OR public.has_role(auth.uid(), 'financeiro')
  );

DROP POLICY IF EXISTS "Gerenciar despesas do fechamento (gerente/diretor)" ON public.weekly_closing_expenses;
CREATE POLICY "Gerenciar despesas do fechamento (diretor)"
  ON public.weekly_closing_expenses FOR ALL
  USING (public.has_role(auth.uid(), 'diretor'))
  WITH CHECK (public.has_role(auth.uid(), 'diretor'));

-- weekly_closing_distribution
DROP POLICY IF EXISTS "Gerenciar distribuição (gerente/diretor)" ON public.weekly_closing_distribution;
CREATE POLICY "Gerenciar distribuição (diretor)"
  ON public.weekly_closing_distribution FOR ALL
  USING (public.has_role(auth.uid(), 'diretor'))
  WITH CHECK (public.has_role(auth.uid(), 'diretor'));
