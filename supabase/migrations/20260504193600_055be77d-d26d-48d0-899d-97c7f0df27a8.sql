CREATE INDEX IF NOT EXISTS idx_shows_status ON public.shows (status);
CREATE INDEX IF NOT EXISTS idx_shows_created_by_data ON public.shows (created_by, data_show DESC);
CREATE INDEX IF NOT EXISTS idx_shows_data_status_active
  ON public.shows (data_show DESC, status)
  WHERE status <> 'cancelada'::show_status;
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles (role);