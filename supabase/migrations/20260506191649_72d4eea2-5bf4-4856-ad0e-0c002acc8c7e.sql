ALTER TABLE public.producer_recurring_expenses
  ADD COLUMN IF NOT EXISTS subcategoria text,
  ADD COLUMN IF NOT EXISTS tipo_despesa text DEFAULT 'custo_operacional',
  ADD COLUMN IF NOT EXISTS artist_id uuid REFERENCES public.artists(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS projeto text,
  ADD COLUMN IF NOT EXISTS centro_custo text DEFAULT 'produtora',
  ADD COLUMN IF NOT EXISTS banco text,
  ADD COLUMN IF NOT EXISTS agencia text,
  ADD COLUMN IF NOT EXISTS conta text,
  ADD COLUMN IF NOT EXISTS tipo_conta text,
  ADD COLUMN IF NOT EXISTS chave_pix text,
  ADD COLUMN IF NOT EXISTS tipo_chave_pix text,
  ADD COLUMN IF NOT EXISTS departamento text,
  ADD COLUMN IF NOT EXISTS tipo_contrato text,
  ADD COLUMN IF NOT EXISTS cpf_cnpj text,
  ADD COLUMN IF NOT EXISTS tags text;

CREATE INDEX IF NOT EXISTS idx_recurring_artist ON public.producer_recurring_expenses(artist_id);