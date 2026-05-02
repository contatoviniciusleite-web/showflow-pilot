-- Cadastro automático de contratante: configurável via app_settings
INSERT INTO public.app_settings (key, value, description)
VALUES ('auto_link_contratante', 'true'::jsonb, 'Quando true, ao salvar uma minuta o contratante é automaticamente cadastrado/vinculado pelo CPF/CNPJ.')
ON CONFLICT (key) DO NOTHING;

-- Índice funcional para busca rápida por documento normalizado (apenas dígitos)
CREATE INDEX IF NOT EXISTS idx_contratantes_documento_digits
  ON public.contratantes ((regexp_replace(coalesce(documento, ''), '[^0-9]', '', 'g')));
