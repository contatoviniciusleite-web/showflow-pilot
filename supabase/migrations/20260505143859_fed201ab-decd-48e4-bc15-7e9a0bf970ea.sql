-- shows
CREATE INDEX IF NOT EXISTS idx_shows_artist_id
  ON public.shows (artist_id);

CREATE INDEX IF NOT EXISTS idx_shows_artist_data
  ON public.shows (artist_id, data_show DESC);

CREATE INDEX IF NOT EXISTS idx_shows_contratante_link_token
  ON public.shows (contratante_link_token)
  WHERE contratante_link_token IS NOT NULL;

-- show_payments
CREATE INDEX IF NOT EXISTS idx_show_payments_show_id
  ON public.show_payments (show_id);

CREATE INDEX IF NOT EXISTS idx_show_payments_status
  ON public.show_payments (show_id, created_at DESC);

-- notifications (coluna correta: lida)
CREATE INDEX IF NOT EXISTS idx_notifications_user_id
  ON public.notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON public.notifications (user_id, lida)
  WHERE lida = false;

-- artists (usa coluna ativo)
CREATE INDEX IF NOT EXISTS idx_artists_active
  ON public.artists (id)
  WHERE ativo = true;

-- contratantes (coluna correta: documento)
CREATE INDEX IF NOT EXISTS idx_contratantes_documento
  ON public.contratantes (documento)
  WHERE documento IS NOT NULL;
