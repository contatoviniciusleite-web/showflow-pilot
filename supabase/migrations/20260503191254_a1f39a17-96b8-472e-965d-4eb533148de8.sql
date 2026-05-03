-- Adiciona novos status para o fluxo em 4 etapas da minuta
ALTER TYPE public.show_status ADD VALUE IF NOT EXISTS 'aguardando_dados';
ALTER TYPE public.show_status ADD VALUE IF NOT EXISTS 'rejeitada';

-- Colunas de rastreio das novas etapas
ALTER TABLE public.shows
  ADD COLUMN IF NOT EXISTS rejeitada_motivo TEXT,
  ADD COLUMN IF NOT EXISTS rejeitada_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejeitada_por UUID,
  ADD COLUMN IF NOT EXISTS dados_completos_em TIMESTAMPTZ;