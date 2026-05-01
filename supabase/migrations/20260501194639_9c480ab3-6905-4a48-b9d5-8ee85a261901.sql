DROP POLICY IF EXISTS "Ver shows conforme papel" ON public.shows;
CREATE POLICY "Ver shows conforme papel"
  ON public.shows FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'gerente'::app_role)
    OR public.has_role(auth.uid(), 'equipe'::app_role)
    OR public.has_role(auth.uid(), 'financeiro'::app_role)
    OR (public.has_role(auth.uid(), 'vendedor'::app_role) AND created_by = auth.uid())
    OR (public.has_role(auth.uid(), 'artista'::app_role) AND artist_id = public.get_my_artist_id())
  );