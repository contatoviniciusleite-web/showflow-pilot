
-- =====================================================
-- 1. Configuração financeira por artista
-- =====================================================
CREATE TABLE public.artist_financial_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id uuid NOT NULL UNIQUE REFERENCES public.artists(id) ON DELETE CASCADE,
  artista_percentual numeric NOT NULL DEFAULT 0,
  imposto_percentual numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.artist_financial_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem config financeira"
  ON public.artist_financial_config FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Gerente/Diretor gerenciam config financeira"
  ON public.artist_financial_config FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'gerente') OR public.has_role(auth.uid(), 'diretor'))
  WITH CHECK (public.has_role(auth.uid(), 'gerente') OR public.has_role(auth.uid(), 'diretor'));

CREATE TRIGGER trg_afc_updated_at BEFORE UPDATE ON public.artist_financial_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================
-- 2. Sócios / parceiros do artista
-- =====================================================
CREATE TABLE public.artist_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id uuid NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  nome text NOT NULL,
  funcao text,
  percentual numeric NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_artist_partners_artist ON public.artist_partners(artist_id);
ALTER TABLE public.artist_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem sócios"
  ON public.artist_partners FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Gerente/Diretor gerenciam sócios"
  ON public.artist_partners FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'gerente') OR public.has_role(auth.uid(), 'diretor'))
  WITH CHECK (public.has_role(auth.uid(), 'gerente') OR public.has_role(auth.uid(), 'diretor'));

-- =====================================================
-- 3. Equipe base do artista
-- =====================================================
CREATE TABLE public.artist_crew (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id uuid NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  nome text NOT NULL,
  funcao text,
  cache_por_show numeric NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_artist_crew_artist ON public.artist_crew(artist_id);
ALTER TABLE public.artist_crew ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem equipe base"
  ON public.artist_crew FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Gerente/Diretor gerenciam equipe base"
  ON public.artist_crew FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'gerente') OR public.has_role(auth.uid(), 'diretor'))
  WITH CHECK (public.has_role(auth.uid(), 'gerente') OR public.has_role(auth.uid(), 'diretor'));

-- =====================================================
-- 4. Fechamentos semanais
-- =====================================================
CREATE TABLE public.weekly_closings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id uuid NOT NULL REFERENCES public.artists(id) ON DELETE RESTRICT,
  semana_inicio date NOT NULL,
  semana_fim date NOT NULL,
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','finalizado')),
  observacoes text,
  total_bruto numeric NOT NULL DEFAULT 0,
  total_comissao_vendedores numeric NOT NULL DEFAULT 0,
  total_equipe numeric NOT NULL DEFAULT 0,
  total_despesas numeric NOT NULL DEFAULT 0,
  total_sobra numeric NOT NULL DEFAULT 0,
  criado_por uuid,
  finalizado_por uuid,
  finalizado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (artist_id, semana_inicio)
);
CREATE INDEX idx_weekly_closings_artist ON public.weekly_closings(artist_id);
CREATE INDEX idx_weekly_closings_semana ON public.weekly_closings(semana_inicio);
ALTER TABLE public.weekly_closings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver fechamentos (gerente/diretor/financeiro)"
  ON public.weekly_closings FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'gerente')
    OR public.has_role(auth.uid(), 'diretor')
    OR public.has_role(auth.uid(), 'financeiro')
  );

CREATE POLICY "Gerente/Diretor gerenciam fechamentos"
  ON public.weekly_closings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'gerente') OR public.has_role(auth.uid(), 'diretor'))
  WITH CHECK (public.has_role(auth.uid(), 'gerente') OR public.has_role(auth.uid(), 'diretor'));

CREATE TRIGGER trg_wc_updated_at BEFORE UPDATE ON public.weekly_closings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================
-- 5. Shows do fechamento
-- =====================================================
CREATE TABLE public.weekly_closing_shows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  closing_id uuid NOT NULL REFERENCES public.weekly_closings(id) ON DELETE CASCADE,
  show_id uuid NOT NULL REFERENCES public.shows(id) ON DELETE RESTRICT,
  cache_total numeric NOT NULL DEFAULT 0,
  comissao_vendedor numeric NOT NULL DEFAULT 0,
  incluido boolean NOT NULL DEFAULT true,
  UNIQUE (closing_id, show_id)
);
CREATE INDEX idx_wcs_closing ON public.weekly_closing_shows(closing_id);
ALTER TABLE public.weekly_closing_shows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver shows do fechamento"
  ON public.weekly_closing_shows FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'gerente')
    OR public.has_role(auth.uid(), 'diretor')
    OR public.has_role(auth.uid(), 'financeiro')
  );

CREATE POLICY "Gerente/Diretor gerenciam shows do fechamento"
  ON public.weekly_closing_shows FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'gerente') OR public.has_role(auth.uid(), 'diretor'))
  WITH CHECK (public.has_role(auth.uid(), 'gerente') OR public.has_role(auth.uid(), 'diretor'));

-- =====================================================
-- 6. Equipe do fechamento
-- =====================================================
CREATE TABLE public.weekly_closing_crew (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  closing_id uuid NOT NULL REFERENCES public.weekly_closings(id) ON DELETE CASCADE,
  nome text NOT NULL,
  funcao text,
  cache_por_show numeric NOT NULL DEFAULT 0,
  shows_participados integer NOT NULL DEFAULT 0,
  total_receber numeric NOT NULL DEFAULT 0,
  ordem integer NOT NULL DEFAULT 0
);
CREATE INDEX idx_wcc_closing ON public.weekly_closing_crew(closing_id);
ALTER TABLE public.weekly_closing_crew ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver equipe do fechamento"
  ON public.weekly_closing_crew FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'gerente')
    OR public.has_role(auth.uid(), 'diretor')
    OR public.has_role(auth.uid(), 'financeiro')
  );

CREATE POLICY "Gerente/Diretor gerenciam equipe do fechamento"
  ON public.weekly_closing_crew FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'gerente') OR public.has_role(auth.uid(), 'diretor'))
  WITH CHECK (public.has_role(auth.uid(), 'gerente') OR public.has_role(auth.uid(), 'diretor'));

-- =====================================================
-- 7. Despesas do fechamento
-- =====================================================
CREATE TABLE public.weekly_closing_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  closing_id uuid NOT NULL REFERENCES public.weekly_closings(id) ON DELETE CASCADE,
  categoria text NOT NULL DEFAULT 'outros',
  descricao text,
  valor numeric NOT NULL DEFAULT 0,
  responsavel text NOT NULL DEFAULT 'produtora',
  incluir_no_calculo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_wce_closing ON public.weekly_closing_expenses(closing_id);
ALTER TABLE public.weekly_closing_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver despesas do fechamento"
  ON public.weekly_closing_expenses FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'gerente')
    OR public.has_role(auth.uid(), 'diretor')
    OR public.has_role(auth.uid(), 'financeiro')
  );

CREATE POLICY "Gerente/Diretor gerenciam despesas do fechamento"
  ON public.weekly_closing_expenses FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'gerente') OR public.has_role(auth.uid(), 'diretor'))
  WITH CHECK (public.has_role(auth.uid(), 'gerente') OR public.has_role(auth.uid(), 'diretor'));

-- =====================================================
-- 8. Distribuição calculada
-- =====================================================
CREATE TABLE public.weekly_closing_distribution (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  closing_id uuid NOT NULL REFERENCES public.weekly_closings(id) ON DELETE CASCADE,
  beneficiario text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('artista','socio','parceiro','produtora')),
  percentual numeric NOT NULL DEFAULT 0,
  valor_bruto numeric NOT NULL DEFAULT 0,
  imposto_valor numeric NOT NULL DEFAULT 0,
  valor_liquido numeric NOT NULL DEFAULT 0,
  ordem integer NOT NULL DEFAULT 0
);
CREATE INDEX idx_wcd_closing ON public.weekly_closing_distribution(closing_id);
ALTER TABLE public.weekly_closing_distribution ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver distribuição do fechamento"
  ON public.weekly_closing_distribution FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'gerente')
    OR public.has_role(auth.uid(), 'diretor')
    OR public.has_role(auth.uid(), 'financeiro')
  );

CREATE POLICY "Gerente/Diretor gerenciam distribuição"
  ON public.weekly_closing_distribution FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'gerente') OR public.has_role(auth.uid(), 'diretor'))
  WITH CHECK (public.has_role(auth.uid(), 'gerente') OR public.has_role(auth.uid(), 'diretor'));

-- =====================================================
-- 9. Trigger: bloquear edição quando finalizado
-- =====================================================
CREATE OR REPLACE FUNCTION public.prevent_edit_finalized_closing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  closing_status text;
  target_closing_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'weekly_closings' THEN
    -- Permite mudar status (reabrir) e atualizar timestamps; bloqueia outras alterações em fechado
    IF TG_OP = 'UPDATE' AND OLD.status = 'finalizado' AND NEW.status = 'finalizado' THEN
      -- Permite somente alteração de campos de finalização (idempotente). Bloqueia conteúdo.
      IF (OLD.observacoes IS DISTINCT FROM NEW.observacoes
          OR OLD.total_bruto IS DISTINCT FROM NEW.total_bruto
          OR OLD.semana_inicio IS DISTINCT FROM NEW.semana_inicio
          OR OLD.artist_id IS DISTINCT FROM NEW.artist_id) THEN
        RAISE EXCEPTION 'Fechamento finalizado não pode ser editado. Reabra antes de alterar.'
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  target_closing_id := COALESCE(
    (CASE WHEN TG_OP = 'DELETE' THEN OLD.closing_id ELSE NEW.closing_id END)
  );

  SELECT status INTO closing_status FROM public.weekly_closings WHERE id = target_closing_id;
  IF closing_status = 'finalizado' THEN
    RAISE EXCEPTION 'Fechamento finalizado não pode ser editado.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_wc_prevent_edit
  BEFORE UPDATE ON public.weekly_closings
  FOR EACH ROW EXECUTE FUNCTION public.prevent_edit_finalized_closing();

CREATE TRIGGER trg_wcs_prevent_edit
  BEFORE INSERT OR UPDATE OR DELETE ON public.weekly_closing_shows
  FOR EACH ROW EXECUTE FUNCTION public.prevent_edit_finalized_closing();

CREATE TRIGGER trg_wcc_prevent_edit
  BEFORE INSERT OR UPDATE OR DELETE ON public.weekly_closing_crew
  FOR EACH ROW EXECUTE FUNCTION public.prevent_edit_finalized_closing();

CREATE TRIGGER trg_wce_prevent_edit
  BEFORE INSERT OR UPDATE OR DELETE ON public.weekly_closing_expenses
  FOR EACH ROW EXECUTE FUNCTION public.prevent_edit_finalized_closing();
