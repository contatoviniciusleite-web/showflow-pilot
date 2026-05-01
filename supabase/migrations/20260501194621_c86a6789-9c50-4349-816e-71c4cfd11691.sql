-- Permissões de artistas por vendedor
CREATE TABLE IF NOT EXISTS public.vendedor_artists (
  vendedor_id uuid NOT NULL,
  artist_id uuid NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (vendedor_id, artist_id)
);

ALTER TABLE public.vendedor_artists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gerente gerencia vendedor_artists"
  ON public.vendedor_artists
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'gerente'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'gerente'::app_role));

CREATE POLICY "Vendedor vê próprias permissões"
  ON public.vendedor_artists
  FOR SELECT TO authenticated
  USING (vendedor_id = auth.uid() OR public.has_role(auth.uid(), 'gerente'::app_role));

CREATE INDEX IF NOT EXISTS vendedor_artists_artist_idx ON public.vendedor_artists(artist_id);

-- View pública (sanitizada) de shows para vendedores enxergarem dias ocupados
DROP VIEW IF EXISTS public.shows_public_view;
CREATE VIEW public.shows_public_view
WITH (security_invoker = true) AS
SELECT s.id, s.artist_id, a.nome AS artist_nome, a.cor AS artist_cor,
       s.data_show, s.horario, s.local, s.cidade, s.created_by, s.status
FROM public.shows s
LEFT JOIN public.artists a ON a.id = s.artist_id
WHERE s.status::text <> 'cancelada';

GRANT SELECT ON public.shows_public_view TO authenticated;

-- Permitir que vendedores enxerguem (apenas via view pública sanitizada) shows de artistas liberados a eles, mesmo de outros vendedores
DROP POLICY IF EXISTS "Ver shows conforme papel" ON public.shows;
CREATE POLICY "Ver shows conforme papel"
  ON public.shows FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'gerente'::app_role)
    OR public.has_role(auth.uid(), 'equipe'::app_role)
    OR public.has_role(auth.uid(), 'financeiro'::app_role)
    OR (public.has_role(auth.uid(), 'vendedor'::app_role) AND created_by = auth.uid())
    OR (
      public.has_role(auth.uid(), 'vendedor'::app_role)
      AND artist_id IN (SELECT artist_id FROM public.vendedor_artists WHERE vendedor_id = auth.uid())
    )
    OR (public.has_role(auth.uid(), 'artista'::app_role) AND artist_id = public.get_my_artist_id())
  );