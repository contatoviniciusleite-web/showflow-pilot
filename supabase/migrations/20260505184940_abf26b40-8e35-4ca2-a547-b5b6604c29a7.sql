
-- ============ weekly_closings ============
DROP POLICY IF EXISTS "Gerenciar fechamentos (diretor)" ON public.weekly_closings;
DROP POLICY IF EXISTS "Gerente/Diretor gerenciam fechamentos" ON public.weekly_closings;
DROP POLICY IF EXISTS "Ver fechamentos (diretor/financeiro)" ON public.weekly_closings;
DROP POLICY IF EXISTS "Artista vê próprios fechamentos finalizados" ON public.weekly_closings;

CREATE POLICY "Financeiro gerencia fechamentos"
  ON public.weekly_closings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'financeiro'::app_role))
  WITH CHECK (has_role(auth.uid(), 'financeiro'::app_role));

CREATE POLICY "Diretor/Financeiro veem fechamentos"
  ON public.weekly_closings FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'diretor'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));

CREATE POLICY "Artista vê próprios fechamentos finalizados"
  ON public.weekly_closings FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'artista'::app_role) AND artist_id = get_my_artist_id() AND status = 'finalizado');

-- ============ weekly_closing_shows ============
DROP POLICY IF EXISTS "Gerenciar shows do fechamento (diretor)" ON public.weekly_closing_shows;
DROP POLICY IF EXISTS "Gerente/Diretor gerenciam shows do fechamento" ON public.weekly_closing_shows;
DROP POLICY IF EXISTS "Ver shows do fechamento" ON public.weekly_closing_shows;
DROP POLICY IF EXISTS "Ver shows do fechamento (diretor/financeiro)" ON public.weekly_closing_shows;

CREATE POLICY "Financeiro gerencia shows do fechamento"
  ON public.weekly_closing_shows FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'financeiro'::app_role))
  WITH CHECK (has_role(auth.uid(), 'financeiro'::app_role));

CREATE POLICY "Diretor/Financeiro veem shows do fechamento"
  ON public.weekly_closing_shows FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'diretor'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));

CREATE POLICY "Artista vê shows do próprio fechamento finalizado"
  ON public.weekly_closing_shows FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'artista'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.weekly_closings wc
      WHERE wc.id = weekly_closing_shows.closing_id
        AND wc.artist_id = get_my_artist_id()
        AND wc.status = 'finalizado'
    )
  );

-- ============ weekly_closing_crew ============
DROP POLICY IF EXISTS "Gerenciar equipe do fechamento (diretor)" ON public.weekly_closing_crew;
DROP POLICY IF EXISTS "Gerente/Diretor gerenciam equipe do fechamento" ON public.weekly_closing_crew;
DROP POLICY IF EXISTS "Ver equipe do fechamento" ON public.weekly_closing_crew;
DROP POLICY IF EXISTS "Ver equipe do fechamento (diretor/financeiro)" ON public.weekly_closing_crew;

CREATE POLICY "Financeiro gerencia equipe do fechamento"
  ON public.weekly_closing_crew FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'financeiro'::app_role))
  WITH CHECK (has_role(auth.uid(), 'financeiro'::app_role));

CREATE POLICY "Diretor/Financeiro veem equipe do fechamento"
  ON public.weekly_closing_crew FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'diretor'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));

CREATE POLICY "Artista vê equipe do próprio fechamento finalizado"
  ON public.weekly_closing_crew FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'artista'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.weekly_closings wc
      WHERE wc.id = weekly_closing_crew.closing_id
        AND wc.artist_id = get_my_artist_id()
        AND wc.status = 'finalizado'
    )
  );

-- ============ weekly_closing_expenses ============
DROP POLICY IF EXISTS "Gerenciar despesas do fechamento (diretor)" ON public.weekly_closing_expenses;
DROP POLICY IF EXISTS "Gerente/Diretor gerenciam despesas do fechamento" ON public.weekly_closing_expenses;
DROP POLICY IF EXISTS "Ver despesas do fechamento" ON public.weekly_closing_expenses;
DROP POLICY IF EXISTS "Ver despesas do fechamento (diretor/financeiro)" ON public.weekly_closing_expenses;

CREATE POLICY "Financeiro gerencia despesas do fechamento"
  ON public.weekly_closing_expenses FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'financeiro'::app_role))
  WITH CHECK (has_role(auth.uid(), 'financeiro'::app_role));

CREATE POLICY "Diretor/Financeiro veem despesas do fechamento"
  ON public.weekly_closing_expenses FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'diretor'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));

CREATE POLICY "Artista vê despesas do próprio fechamento finalizado"
  ON public.weekly_closing_expenses FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'artista'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.weekly_closings wc
      WHERE wc.id = weekly_closing_expenses.closing_id
        AND wc.artist_id = get_my_artist_id()
        AND wc.status = 'finalizado'
    )
  );

-- ============ weekly_closing_distribution ============
DROP POLICY IF EXISTS "Gerenciar distribuição (diretor)" ON public.weekly_closing_distribution;
DROP POLICY IF EXISTS "Gerente/Diretor gerenciam distribuição" ON public.weekly_closing_distribution;
DROP POLICY IF EXISTS "Ver distribuição do fechamento" ON public.weekly_closing_distribution;
DROP POLICY IF EXISTS "Artista vê própria distribuição" ON public.weekly_closing_distribution;

CREATE POLICY "Financeiro gerencia distribuição"
  ON public.weekly_closing_distribution FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'financeiro'::app_role))
  WITH CHECK (has_role(auth.uid(), 'financeiro'::app_role));

CREATE POLICY "Diretor/Financeiro veem distribuição"
  ON public.weekly_closing_distribution FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'diretor'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));

CREATE POLICY "Artista vê distribuição do próprio fechamento finalizado"
  ON public.weekly_closing_distribution FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'artista'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.weekly_closings wc
      WHERE wc.id = weekly_closing_distribution.closing_id
        AND wc.artist_id = get_my_artist_id()
        AND wc.status = 'finalizado'
    )
  );

-- ============ Atualizar trigger de notificação (nova mensagem) ============
CREATE OR REPLACE FUNCTION public.notify_artist_closing_finalized()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  liquido numeric;
  user_rec record;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.status = 'finalizado'
     AND COALESCE(OLD.status, '') <> 'finalizado' THEN

    SELECT COALESCE(SUM(valor_liquido), 0) INTO liquido
    FROM public.weekly_closing_distribution
    WHERE closing_id = NEW.id AND tipo = 'artista';

    FOR user_rec IN
      SELECT user_id FROM public.user_roles
      WHERE role = 'artista'::app_role AND artist_id = NEW.artist_id
    LOOP
      INSERT INTO public.notifications (user_id, tipo, titulo, mensagem)
      VALUES (
        user_rec.user_id,
        'fechamento_finalizado',
        'Fechamento finalizado',
        'Fechamento de ' ||
          to_char(NEW.semana_inicio, 'DD/MM/YYYY') || ' a ' ||
          to_char(NEW.semana_fim, 'DD/MM/YYYY') ||
          ' finalizado. Valor líquido a receber: R$ ' ||
          to_char(liquido, 'FM999G999G990D00')
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$function$;
