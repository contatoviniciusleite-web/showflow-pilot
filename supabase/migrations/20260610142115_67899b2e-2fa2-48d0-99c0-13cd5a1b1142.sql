GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_artist_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_socio_of(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_comprovantes(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_comprovante(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_business_day_br(date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.add_business_hours_br(timestamptz, numeric) TO authenticated, service_role;