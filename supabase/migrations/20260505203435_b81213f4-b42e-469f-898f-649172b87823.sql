CREATE TABLE public.weekly_closing_clipe (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  closing_id uuid NOT NULL REFERENCES public.weekly_closings(id) ON DELETE CASCADE,
  profissional text NOT NULL DEFAULT '',
  funcao text DEFAULT '',
  clipe text DEFAULT '',
  quantidade integer NOT NULL DEFAULT 1,
  valor_por_clipe numeric NOT NULL DEFAULT 0,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.weekly_closing_clipe ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Diretor/Financeiro veem clipe do fechamento"
ON public.weekly_closing_clipe FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'diretor'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));

CREATE POLICY "Financeiro gerencia clipe do fechamento"
ON public.weekly_closing_clipe FOR ALL TO authenticated
USING (has_role(auth.uid(), 'financeiro'::app_role))
WITH CHECK (has_role(auth.uid(), 'financeiro'::app_role));

CREATE POLICY "Artista vê clipe do próprio fechamento finalizado"
ON public.weekly_closing_clipe FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'artista'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.weekly_closings wc
    WHERE wc.id = weekly_closing_clipe.closing_id
      AND wc.artist_id = get_my_artist_id()
      AND wc.status = 'finalizado'::text
  )
);

CREATE INDEX idx_weekly_closing_clipe_closing ON public.weekly_closing_clipe(closing_id);

-- Coluna total_clipe no closing
ALTER TABLE public.weekly_closings ADD COLUMN IF NOT EXISTS total_clipe numeric NOT NULL DEFAULT 0;