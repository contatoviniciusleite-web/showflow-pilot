-- 1. Colunas extras em shows
ALTER TABLE public.shows
  ADD COLUMN IF NOT EXISTS data_show_original date,
  ADD COLUMN IF NOT EXISTS horario_original time,
  ADD COLUMN IF NOT EXISTS remarcado_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS remarcado_de_show_id uuid,
  ADD COLUMN IF NOT EXISTS ultima_remarcacao_em timestamptz,
  ADD COLUMN IF NOT EXISTS ultima_remarcacao_motivo text,
  ADD COLUMN IF NOT EXISTS ultima_remarcacao_por uuid;

-- 2. Histórico de remarcações
CREATE TABLE IF NOT EXISTS public.show_reschedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id uuid NOT NULL,
  show_anterior_id uuid,
  data_anterior date NOT NULL,
  horario_anterior time,
  data_nova date NOT NULL,
  horario_novo time,
  motivo text NOT NULL,
  remarcado_por uuid,
  remarcado_por_nome text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_show_reschedules_show_id ON public.show_reschedules(show_id);

ALTER TABLE public.show_reschedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ver remarcacoes conforme papel" ON public.show_reschedules;
CREATE POLICY "Ver remarcacoes conforme papel"
ON public.show_reschedules
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'gerente'::app_role)
  OR has_role(auth.uid(), 'financeiro'::app_role)
  OR has_role(auth.uid(), 'equipe'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.shows s
    WHERE s.id = show_reschedules.show_id
      AND has_role(auth.uid(), 'artista'::app_role)
      AND s.artist_id = get_my_artist_id()
  )
);

-- escrita só via service role (edge function); nenhuma policy de insert