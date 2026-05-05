ALTER TABLE public.weekly_closing_shows
  ADD COLUMN IF NOT EXISTS custo_equipe numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS van numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS outras_despesas numeric NOT NULL DEFAULT 0;