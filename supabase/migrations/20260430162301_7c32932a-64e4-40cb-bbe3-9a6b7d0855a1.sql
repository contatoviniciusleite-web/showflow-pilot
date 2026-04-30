-- Allow 'vendedor' to view shows
DROP POLICY IF EXISTS "Ver shows conforme papel" ON public.shows;
CREATE POLICY "Ver shows conforme papel"
ON public.shows FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'gerente'::app_role)
  OR has_role(auth.uid(), 'equipe'::app_role)
  OR has_role(auth.uid(), 'vendedor'::app_role)
  OR (has_role(auth.uid(), 'artista'::app_role) AND artist_id = get_my_artist_id())
);

-- Allow 'vendedor' to create shows
DROP POLICY IF EXISTS "Gerente e equipe criam shows" ON public.shows;
CREATE POLICY "Gerente, equipe e vendedor criam shows"
ON public.shows FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'gerente'::app_role)
  OR has_role(auth.uid(), 'equipe'::app_role)
  OR has_role(auth.uid(), 'vendedor'::app_role)
);

-- Allow 'vendedor' to update shows
DROP POLICY IF EXISTS "Gerente e equipe atualizam shows" ON public.shows;
CREATE POLICY "Gerente, equipe e vendedor atualizam shows"
ON public.shows FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'gerente'::app_role)
  OR has_role(auth.uid(), 'equipe'::app_role)
  OR has_role(auth.uid(), 'vendedor'::app_role)
);