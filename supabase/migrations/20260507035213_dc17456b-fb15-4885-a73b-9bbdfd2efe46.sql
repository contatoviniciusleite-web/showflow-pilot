CREATE TABLE IF NOT EXISTS public.socio_artists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  socio_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  artist_id uuid NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(socio_id, artist_id)
);

ALTER TABLE public.socio_artists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sócio vê próprios vínculos" ON public.socio_artists
FOR SELECT TO authenticated
USING (socio_id = auth.uid() OR has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'diretor'::app_role));

CREATE POLICY "Gerente/Diretor gerenciam vínculos sócio" ON public.socio_artists
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'diretor'::app_role))
WITH CHECK (has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'diretor'::app_role));

-- Update helper to read from socio_artists
CREATE OR REPLACE FUNCTION public.is_socio_of(_artist_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.socio_artists
    WHERE socio_id = auth.uid() AND artist_id = _artist_id
  );
$$;
