-- Storage policies for comprovantes bucket: align with role permissions

-- Ensure bucket exists with size + mime restrictions
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

-- SELECT: gerente, equipe, financeiro veem tudo; vendedor vê apenas dos shows criados por ele
DROP POLICY IF EXISTS "Comprovantes: leitura por papel autorizado" ON storage.objects;
CREATE POLICY "Comprovantes: leitura por papel autorizado" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'comprovantes' AND (
      public.has_role(auth.uid(), 'gerente'::app_role)
      OR public.has_role(auth.uid(), 'equipe'::app_role)
      OR public.has_role(auth.uid(), 'financeiro'::app_role)
      OR (
        public.has_role(auth.uid(), 'vendedor'::app_role)
        AND EXISTS (
          SELECT 1 FROM public.shows s
          WHERE s.id::text = (storage.foldername(name))[1]
            AND s.created_by = auth.uid()
        )
      )
    )
  );

-- INSERT: gerente, equipe, financeiro podem; vendedor só para shows criados por ele
DROP POLICY IF EXISTS "Comprovantes: vendedor envia próprio show" ON storage.objects;
DROP POLICY IF EXISTS "Comprovantes: insert por papel autorizado" ON storage.objects;
CREATE POLICY "Comprovantes: insert por papel autorizado" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'comprovantes' AND (
      public.has_role(auth.uid(), 'gerente'::app_role)
      OR public.has_role(auth.uid(), 'equipe'::app_role)
      OR public.has_role(auth.uid(), 'financeiro'::app_role)
      OR (
        public.has_role(auth.uid(), 'vendedor'::app_role)
        AND EXISTS (
          SELECT 1 FROM public.shows s
          WHERE s.id::text = (storage.foldername(name))[1]
            AND s.created_by = auth.uid()
        )
      )
    )
  );

-- UPDATE: apenas gerente, equipe e financeiro (vendedor não pode substituir)
DROP POLICY IF EXISTS "Comprovantes: update por gerencia/financeiro" ON storage.objects;
CREATE POLICY "Comprovantes: update por gerencia/financeiro" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'comprovantes' AND (
      public.has_role(auth.uid(), 'gerente'::app_role)
      OR public.has_role(auth.uid(), 'equipe'::app_role)
      OR public.has_role(auth.uid(), 'financeiro'::app_role)
    )
  )
  WITH CHECK (
    bucket_id = 'comprovantes' AND (
      public.has_role(auth.uid(), 'gerente'::app_role)
      OR public.has_role(auth.uid(), 'equipe'::app_role)
      OR public.has_role(auth.uid(), 'financeiro'::app_role)
    )
  );

-- DELETE: apenas gerente, equipe e financeiro
DROP POLICY IF EXISTS "Comprovantes: delete por gerencia/financeiro" ON storage.objects;
CREATE POLICY "Comprovantes: delete por gerencia/financeiro" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'comprovantes' AND (
      public.has_role(auth.uid(), 'gerente'::app_role)
      OR public.has_role(auth.uid(), 'equipe'::app_role)
      OR public.has_role(auth.uid(), 'financeiro'::app_role)
    )
  );