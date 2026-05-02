-- Fix comprovantes storage RLS by avoiding direct calls to restricted role helper
-- and using dedicated SECURITY DEFINER helpers scoped to receipt access.

CREATE OR REPLACE FUNCTION public.can_manage_comprovantes(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role IN ('gerente'::public.app_role, 'equipe'::public.app_role, 'financeiro'::public.app_role)
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_comprovante(_user_id uuid, _show_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.can_manage_comprovantes(_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.shows s ON s.id = _show_id
      WHERE ur.user_id = _user_id
        AND ur.role = 'vendedor'::public.app_role
        AND s.created_by = _user_id
    );
$$;

REVOKE ALL ON FUNCTION public.can_manage_comprovantes(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_access_comprovante(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_comprovantes(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_comprovante(uuid, uuid) TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'comprovantes',
  'comprovantes',
  false,
  10485760,
  ARRAY['application/pdf','image/jpeg','image/jpg','image/png']
)
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = 10485760,
      allowed_mime_types = ARRAY['application/pdf','image/jpeg','image/jpg','image/png'];

DROP POLICY IF EXISTS "Comprovantes: leitura por papel autorizado" ON storage.objects;
CREATE POLICY "Comprovantes: leitura por papel autorizado" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'comprovantes'
    AND public.can_access_comprovante(
      auth.uid(),
      ((storage.foldername(name))[1])::uuid
    )
  );

DROP POLICY IF EXISTS "Comprovantes: vendedor envia próprio show" ON storage.objects;
DROP POLICY IF EXISTS "Comprovantes: insert por papel autorizado" ON storage.objects;
CREATE POLICY "Comprovantes: insert por papel autorizado" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'comprovantes'
    AND public.can_access_comprovante(
      auth.uid(),
      ((storage.foldername(name))[1])::uuid
    )
  );

DROP POLICY IF EXISTS "Comprovantes: update por gerencia/financeiro" ON storage.objects;
CREATE POLICY "Comprovantes: update por gerencia/financeiro" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'comprovantes'
    AND public.can_manage_comprovantes(auth.uid())
  )
  WITH CHECK (
    bucket_id = 'comprovantes'
    AND public.can_manage_comprovantes(auth.uid())
  );

DROP POLICY IF EXISTS "Comprovantes: delete por gerencia/financeiro" ON storage.objects;
CREATE POLICY "Comprovantes: delete por gerencia/financeiro" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'comprovantes'
    AND public.can_manage_comprovantes(auth.uid())
  );