ALTER TABLE public.weekly_closing_clipe
  ADD COLUMN IF NOT EXISTS desconto_de text NOT NULL DEFAULT 'todos',
  ADD COLUMN IF NOT EXISTS categoria text NOT NULL DEFAULT 'clipe';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'weekly_closing_clipe_desconto_de_check'
  ) THEN
    ALTER TABLE public.weekly_closing_clipe
      ADD CONSTRAINT weekly_closing_clipe_desconto_de_check
      CHECK (desconto_de IN ('todos','socios','artista'));
  END IF;
END $$;