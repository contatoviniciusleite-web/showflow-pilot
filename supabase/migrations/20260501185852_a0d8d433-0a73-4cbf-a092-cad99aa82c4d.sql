-- Tabela de bloqueio de datas
CREATE TABLE public.blocked_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id uuid NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  data date NOT NULL,
  motivo text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índice único: só um bloqueio por (artista, data); só um bloqueio global por data
CREATE UNIQUE INDEX blocked_dates_artist_data_key
  ON public.blocked_dates (artist_id, data)
  WHERE artist_id IS NOT NULL;

CREATE UNIQUE INDEX blocked_dates_global_data_key
  ON public.blocked_dates (data)
  WHERE artist_id IS NULL;

CREATE INDEX blocked_dates_data_idx ON public.blocked_dates (data);

ALTER TABLE public.blocked_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados veem bloqueios"
  ON public.blocked_dates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Gerente gerencia bloqueios"
  ON public.blocked_dates FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'gerente'::app_role))
  WITH CHECK (has_role(auth.uid(), 'gerente'::app_role));