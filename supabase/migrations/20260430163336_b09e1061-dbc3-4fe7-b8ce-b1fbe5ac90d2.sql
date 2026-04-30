DROP POLICY IF EXISTS "Gerente, equipe e vendedor atualizam shows" ON public.shows;
CREATE POLICY "Gerente e equipe atualizam shows"
ON public.shows FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'gerente'::app_role)
  OR has_role(auth.uid(), 'equipe'::app_role)
);