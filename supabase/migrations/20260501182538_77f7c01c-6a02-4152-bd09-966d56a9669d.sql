
-- 1) artists.cache_minimo
ALTER TABLE public.artists
  ADD COLUMN IF NOT EXISTS cache_minimo numeric NOT NULL DEFAULT 0;

-- 2) shows: new flow columns
ALTER TABLE public.shows
  ADD COLUMN IF NOT EXISTS prazo_comprovante_em timestamptz,
  ADD COLUMN IF NOT EXISTS aviso_12h_enviado_em timestamptz,
  ADD COLUMN IF NOT EXISTS comprovante_url text,
  ADD COLUMN IF NOT EXISTS comprovante_enviado_em timestamptz,
  ADD COLUMN IF NOT EXISTS comprovante_enviado_por uuid,
  ADD COLUMN IF NOT EXISTS confirmado_por uuid,
  ADD COLUMN IF NOT EXISTS confirmado_em timestamptz,
  ADD COLUMN IF NOT EXISTS cancelado_em timestamptz,
  ADD COLUMN IF NOT EXISTS cancelado_motivo text;

-- 3) app_settings
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados leem settings" ON public.app_settings;
CREATE POLICY "Autenticados leem settings" ON public.app_settings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Gerente gerencia settings" ON public.app_settings;
CREATE POLICY "Gerente gerencia settings" ON public.app_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'gerente'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'gerente'::app_role));

INSERT INTO public.app_settings (key, value, description) VALUES
  ('max_shows_per_artist_per_day', '3'::jsonb, 'Limite máximo de shows por artista no mesmo dia'),
  ('prazo_comprovante_horas_uteis', '48'::jsonb, 'Horas úteis para anexar comprovante após aprovação'),
  ('aviso_antes_cancelamento_horas_uteis', '12'::jsonb, 'Horas úteis antes do cancelamento para enviar aviso')
ON CONFLICT (key) DO NOTHING;

-- 4) Update shows_public_view
DROP VIEW IF EXISTS public.shows_public_view;
CREATE VIEW public.shows_public_view AS
SELECT s.id, s.artist_id, a.nome AS artist_nome, a.cor AS artist_cor,
       s.data_show, s.horario, s.local, s.cidade, s.created_by, s.status
FROM public.shows s
LEFT JOIN public.artists a ON a.id = s.artist_id
WHERE s.status IN ('aguardando_pagamento','comprovante_enviado','confirmado');

GRANT SELECT ON public.shows_public_view TO authenticated;

-- 5) RLS shows
DROP POLICY IF EXISTS "Ver shows conforme papel" ON public.shows;
CREATE POLICY "Ver shows conforme papel" ON public.shows
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'gerente'::app_role)
    OR public.has_role(auth.uid(), 'equipe'::app_role)
    OR public.has_role(auth.uid(), 'financeiro'::app_role)
    OR (public.has_role(auth.uid(), 'vendedor'::app_role) AND created_by = auth.uid())
    OR (public.has_role(auth.uid(), 'artista'::app_role) AND artist_id = public.get_my_artist_id())
  );

DROP POLICY IF EXISTS "Ver depósitos conforme papel" ON public.show_deposits;
CREATE POLICY "Ver depósitos conforme papel" ON public.show_deposits
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.shows s
    WHERE s.id = show_deposits.show_id
      AND (
        public.has_role(auth.uid(), 'gerente'::app_role)
        OR public.has_role(auth.uid(), 'equipe'::app_role)
        OR public.has_role(auth.uid(), 'financeiro'::app_role)
        OR (public.has_role(auth.uid(), 'artista'::app_role) AND s.artist_id = public.get_my_artist_id())
      )
  ));

DROP POLICY IF EXISTS "Ver despesas conforme papel" ON public.show_expenses;
CREATE POLICY "Ver despesas conforme papel" ON public.show_expenses
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.shows s
    WHERE s.id = show_expenses.show_id
      AND (
        public.has_role(auth.uid(), 'gerente'::app_role)
        OR public.has_role(auth.uid(), 'equipe'::app_role)
        OR public.has_role(auth.uid(), 'financeiro'::app_role)
        OR (public.has_role(auth.uid(), 'artista'::app_role) AND s.artist_id = public.get_my_artist_id())
      )
  ));

-- 6) Notifications: insert allowed
DROP POLICY IF EXISTS "Inserir notificações via funções" ON public.notifications;
CREATE POLICY "Inserir notificações via funções" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (true);

-- 7) Storage bucket for comprovantes (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('comprovantes', 'comprovantes', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Comprovantes: leitura por papel autorizado" ON storage.objects;
CREATE POLICY "Comprovantes: leitura por papel autorizado" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'comprovantes' AND (
      public.has_role(auth.uid(), 'gerente'::app_role)
      OR public.has_role(auth.uid(), 'equipe'::app_role)
      OR public.has_role(auth.uid(), 'financeiro'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.shows s
        WHERE s.id::text = (storage.foldername(name))[1]
          AND s.created_by = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Comprovantes: vendedor envia próprio show" ON storage.objects;
CREATE POLICY "Comprovantes: vendedor envia próprio show" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'comprovantes' AND (
      public.has_role(auth.uid(), 'gerente'::app_role)
      OR public.has_role(auth.uid(), 'equipe'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.shows s
        WHERE s.id::text = (storage.foldername(name))[1]
          AND s.created_by = auth.uid()
      )
    )
  );

-- 8) add_business_hours helper
CREATE OR REPLACE FUNCTION public.add_business_hours(start_ts timestamptz, hours_to_add numeric)
RETURNS timestamptz
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  remaining numeric := hours_to_add;
  cur timestamptz := start_ts;
  step numeric;
  hours_in_day numeric;
BEGIN
  WHILE remaining > 0 LOOP
    IF EXTRACT(ISODOW FROM cur) >= 6 THEN
      cur := date_trunc('day', cur) + ((8 - EXTRACT(ISODOW FROM cur))::int || ' days')::interval;
      CONTINUE;
    END IF;
    hours_in_day := 24 - EXTRACT(EPOCH FROM (cur - date_trunc('day', cur))) / 3600;
    step := LEAST(remaining, hours_in_day);
    cur := cur + (step || ' hours')::interval;
    remaining := remaining - step;
  END LOOP;
  RETURN cur;
END;
$$;
