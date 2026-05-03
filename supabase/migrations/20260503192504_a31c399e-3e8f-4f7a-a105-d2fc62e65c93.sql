
CREATE TABLE IF NOT EXISTS public.show_payment_schedule (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  show_id uuid NOT NULL,
  ordem int NOT NULL DEFAULT 0,
  descricao text,
  data_prevista date,
  percentual numeric,
  valor numeric NOT NULL DEFAULT 0,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_show_payment_schedule_show ON public.show_payment_schedule(show_id);

ALTER TABLE public.show_payment_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver parcelas conforme papel"
ON public.show_payment_schedule FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.shows s WHERE s.id = show_payment_schedule.show_id
  AND (
    has_role(auth.uid(), 'gerente'::app_role)
    OR has_role(auth.uid(), 'equipe'::app_role)
    OR has_role(auth.uid(), 'financeiro'::app_role)
    OR (has_role(auth.uid(), 'vendedor'::app_role) AND s.created_by = auth.uid())
    OR (has_role(auth.uid(), 'artista'::app_role) AND s.artist_id = get_my_artist_id())
  )
));

CREATE POLICY "Gerenciar parcelas conforme papel"
ON public.show_payment_schedule FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.shows s WHERE s.id = show_payment_schedule.show_id
  AND (
    has_role(auth.uid(), 'gerente'::app_role)
    OR has_role(auth.uid(), 'equipe'::app_role)
    OR has_role(auth.uid(), 'financeiro'::app_role)
    OR (has_role(auth.uid(), 'vendedor'::app_role) AND s.created_by = auth.uid())
  )
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.shows s WHERE s.id = show_payment_schedule.show_id
  AND (
    has_role(auth.uid(), 'gerente'::app_role)
    OR has_role(auth.uid(), 'equipe'::app_role)
    OR has_role(auth.uid(), 'financeiro'::app_role)
    OR (has_role(auth.uid(), 'vendedor'::app_role) AND s.created_by = auth.uid())
  )
));

CREATE TRIGGER trg_show_payment_schedule_updated
BEFORE UPDATE ON public.show_payment_schedule
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
