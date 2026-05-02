GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_artist_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_comprovantes(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_comprovante(uuid, uuid) TO authenticated;