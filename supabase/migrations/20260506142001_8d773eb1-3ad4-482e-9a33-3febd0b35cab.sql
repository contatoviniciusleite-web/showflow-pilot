-- Tabela de histórico de mudanças de status dos shows
CREATE TABLE public.show_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id uuid NOT NULL REFERENCES public.shows(id) ON DELETE CASCADE,
  status_anterior text,
  status_novo text NOT NULL,
  motivo text,
  changed_by uuid,
  changed_by_nome text,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_show_status_history_show ON public.show_status_history(show_id, changed_at DESC);

ALTER TABLE public.show_status_history ENABLE ROW LEVEL SECURITY;

-- Visualização: mesma regra de visualização de shows
CREATE POLICY "Ver historico status conforme papel"
ON public.show_status_history
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.shows s
    WHERE s.id = show_status_history.show_id
      AND (
        has_role(auth.uid(), 'gerente'::app_role)
        OR has_role(auth.uid(), 'equipe'::app_role)
        OR has_role(auth.uid(), 'financeiro'::app_role)
        OR has_role(auth.uid(), 'diretor'::app_role)
        OR (has_role(auth.uid(), 'vendedor'::app_role) AND s.created_by = auth.uid())
        OR (has_role(auth.uid(), 'artista'::app_role) AND s.artist_id = get_my_artist_id())
      )
  )
);

-- Inserção manual (raramente; trigger faz a maioria)
CREATE POLICY "Inserir historico status (autenticado)"
ON public.show_status_history
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'gerente'::app_role)
  OR has_role(auth.uid(), 'equipe'::app_role)
  OR has_role(auth.uid(), 'financeiro'::app_role)
  OR has_role(auth.uid(), 'diretor'::app_role)
  OR has_role(auth.uid(), 'vendedor'::app_role)
);

-- Trigger: registra automaticamente toda mudança de status
CREATE OR REPLACE FUNCTION public.log_show_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  uname text;
  motivo_txt text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT nome INTO uname FROM public.profiles WHERE id = uid;
    INSERT INTO public.show_status_history (show_id, status_anterior, status_novo, motivo, changed_by, changed_by_nome)
    VALUES (NEW.id, NULL, NEW.status::text, 'Show criado', uid, uname);
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT nome INTO uname FROM public.profiles WHERE id = uid;
    motivo_txt := COALESCE(
      NEW.cancelado_motivo,
      NEW.rejeitada_motivo,
      NEW.ultima_remarcacao_motivo,
      NULL
    );
    INSERT INTO public.show_status_history (show_id, status_anterior, status_novo, motivo, changed_by, changed_by_nome)
    VALUES (NEW.id, OLD.status::text, NEW.status::text, motivo_txt, uid, uname);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_show_status_change
AFTER INSERT OR UPDATE OF status ON public.shows
FOR EACH ROW
EXECUTE FUNCTION public.log_show_status_change();

-- Backfill: cria registros iniciais para shows existentes (status atual)
INSERT INTO public.show_status_history (show_id, status_anterior, status_novo, motivo, changed_at)
SELECT id, NULL, status::text, 'Registro inicial (backfill)', COALESCE(created_at, now())
FROM public.shows
WHERE NOT EXISTS (
  SELECT 1 FROM public.show_status_history h WHERE h.show_id = shows.id
);