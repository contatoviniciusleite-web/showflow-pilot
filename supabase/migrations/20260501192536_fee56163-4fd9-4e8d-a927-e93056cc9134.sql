ALTER TABLE public.shows
  ADD COLUMN IF NOT EXISTS auto_aprovado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_aprovado_em timestamptz NULL;

CREATE INDEX IF NOT EXISTS idx_shows_auto_aprovado ON public.shows(auto_aprovado) WHERE auto_aprovado = true;