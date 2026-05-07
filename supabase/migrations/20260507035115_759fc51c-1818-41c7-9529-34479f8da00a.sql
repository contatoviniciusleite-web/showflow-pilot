-- Helper: returns array of artist_ids the current user is linked to as 'socio'
CREATE OR REPLACE FUNCTION public.is_socio_of(_artist_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'socio'::public.app_role
      AND artist_id = _artist_id
  );
$$;

-- shows: Sócio vê shows do(s) artista(s) vinculado(s)
DROP POLICY IF EXISTS "Ver shows conforme papel" ON public.shows;
CREATE POLICY "Ver shows conforme papel" ON public.shows
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'gerente'::app_role)
  OR has_role(auth.uid(), 'equipe'::app_role)
  OR has_role(auth.uid(), 'financeiro'::app_role)
  OR has_role(auth.uid(), 'diretor'::app_role)
  OR (has_role(auth.uid(), 'vendedor'::app_role) AND created_by = auth.uid())
  OR (has_role(auth.uid(), 'artista'::app_role) AND artist_id = get_my_artist_id())
  OR (has_role(auth.uid(), 'socio'::app_role) AND is_socio_of(artist_id))
);

-- weekly_closings: Sócio vê fechamentos finalizados do(s) artista(s) vinculado(s)
CREATE POLICY "Sócio vê fechamentos finalizados" ON public.weekly_closings
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'socio'::app_role)
  AND is_socio_of(artist_id)
  AND status = 'finalizado'
);

CREATE POLICY "Sócio vê shows do fechamento" ON public.weekly_closing_shows
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'socio'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.weekly_closings wc
    WHERE wc.id = weekly_closing_shows.closing_id
      AND is_socio_of(wc.artist_id)
      AND wc.status = 'finalizado'
  )
);

CREATE POLICY "Sócio vê distribuição do fechamento" ON public.weekly_closing_distribution
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'socio'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.weekly_closings wc
    WHERE wc.id = weekly_closing_distribution.closing_id
      AND is_socio_of(wc.artist_id)
      AND wc.status = 'finalizado'
  )
);

CREATE POLICY "Sócio vê despesas do fechamento" ON public.weekly_closing_expenses
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'socio'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.weekly_closings wc
    WHERE wc.id = weekly_closing_expenses.closing_id
      AND is_socio_of(wc.artist_id)
      AND wc.status = 'finalizado'
  )
);

CREATE POLICY "Sócio vê clipe do fechamento" ON public.weekly_closing_clipe
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'socio'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.weekly_closings wc
    WHERE wc.id = weekly_closing_clipe.closing_id
      AND is_socio_of(wc.artist_id)
      AND wc.status = 'finalizado'
  )
);

-- artists: já é leitura pública para autenticados; nada a fazer
