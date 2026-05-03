-- Adiciona novo status ao enum show_status
ALTER TYPE public.show_status ADD VALUE IF NOT EXISTS 'aguardando_contratante';

-- Novos campos na tabela shows
ALTER TABLE public.shows
  ADD COLUMN IF NOT EXISTS contratante_link_token uuid UNIQUE,
  ADD COLUMN IF NOT EXISTS contratante_link_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS contratante_link_preenchido boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS contratante_link_preenchido_em timestamptz;

CREATE INDEX IF NOT EXISTS idx_shows_contratante_link_token
  ON public.shows (contratante_link_token)
  WHERE contratante_link_token IS NOT NULL;

-- Configuração ajustável: validade do link em horas (padrão 24)
INSERT INTO public.app_settings (key, value, description)
VALUES ('contratante_link_validade_horas', '24'::jsonb, 'Validade em horas do link público de pré-preenchimento da minuta pelo contratante')
ON CONFLICT (key) DO NOTHING;