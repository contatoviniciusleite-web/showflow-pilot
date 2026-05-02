REVOKE EXECUTE ON FUNCTION public.can_manage_comprovantes(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.can_access_comprovante(uuid, uuid) FROM authenticated;