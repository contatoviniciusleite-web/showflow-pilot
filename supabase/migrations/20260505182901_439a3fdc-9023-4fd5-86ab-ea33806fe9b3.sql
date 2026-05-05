-- 1) Permitir que artista veja seus próprios fechamentos finalizados
CREATE POLICY "Artista vê próprios fechamentos finalizados"
ON public.weekly_closings
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'artista'::app_role)
  AND artist_id = get_my_artist_id()
  AND status = 'finalizado'
);

-- 2) Permitir que artista veja apenas a sua linha de distribuição
CREATE POLICY "Artista vê própria distribuição"
ON public.weekly_closing_distribution
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'artista'::app_role)
  AND tipo = 'artista'
  AND EXISTS (
    SELECT 1 FROM public.weekly_closings wc
    WHERE wc.id = weekly_closing_distribution.closing_id
      AND wc.artist_id = get_my_artist_id()
      AND wc.status = 'finalizado'
  )
);

-- 3) Notificação ao artista quando fechamento é finalizado
CREATE OR REPLACE FUNCTION public.notify_artist_closing_finalized()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  artist_nome text;
  liquido numeric;
  user_rec record;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.status = 'finalizado'
     AND COALESCE(OLD.status, '') <> 'finalizado' THEN

    SELECT nome INTO artist_nome FROM public.artists WHERE id = NEW.artist_id;

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
        'Seu fechamento da semana ' ||
          to_char(NEW.semana_inicio, 'DD/MM/YYYY') || ' a ' ||
          to_char(NEW.semana_fim, 'DD/MM/YYYY') ||
          ' foi finalizado. Valor líquido a receber: R$ ' ||
          to_char(liquido, 'FM999G999G990D00')
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_artist_closing_finalized ON public.weekly_closings;
CREATE TRIGGER trg_notify_artist_closing_finalized
AFTER UPDATE ON public.weekly_closings
FOR EACH ROW
EXECUTE FUNCTION public.notify_artist_closing_finalized();