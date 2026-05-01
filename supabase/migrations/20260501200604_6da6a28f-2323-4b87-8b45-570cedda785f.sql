DROP VIEW IF EXISTS public.shows_public_view;

CREATE VIEW public.shows_public_view
WITH (security_invoker=on) AS
  SELECT s.id,
    s.artist_id,
    a.nome AS artist_nome,
    a.cor AS artist_cor,
    s.data_show,
    s.horario,
    s.local,
    s.cidade,
    s.vendedor,
    s.created_by,
    s.status
  FROM public.shows s
  LEFT JOIN public.artists a ON a.id = s.artist_id
  WHERE s.status::text <> 'cancelada'::text;