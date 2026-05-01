
-- Recreate view with security_invoker
DROP VIEW IF EXISTS public.shows_public_view;
CREATE VIEW public.shows_public_view
WITH (security_invoker = true) AS
SELECT s.id, s.artist_id, a.nome AS artist_nome, a.cor AS artist_cor,
       s.data_show, s.horario, s.local, s.cidade, s.created_by, s.status
FROM public.shows s
LEFT JOIN public.artists a ON a.id = s.artist_id
WHERE s.status IN ('aguardando_pagamento','comprovante_enviado','confirmado');

GRANT SELECT ON public.shows_public_view TO authenticated;

-- Tighten notification insert (service role bypasses RLS anyway)
DROP POLICY IF EXISTS "Inserir notificações via funções" ON public.notifications;
CREATE POLICY "Inserir notificações próprias ou gerente" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'gerente'::app_role)
  );
