-- Tabela de contratantes
CREATE TABLE public.contratantes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  documento text,
  endereco text,
  cidade text,
  estado text,
  cep text,
  telefone text,
  email text,
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_contratantes_nome_lower ON public.contratantes (lower(nome));

ALTER TABLE public.contratantes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver contratantes conforme papel"
  ON public.contratantes FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'gerente'::app_role)
    OR has_role(auth.uid(), 'financeiro'::app_role)
    OR has_role(auth.uid(), 'equipe'::app_role)
    OR has_role(auth.uid(), 'vendedor'::app_role)
  );

CREATE POLICY "Inserir contratantes conforme papel"
  ON public.contratantes FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'gerente'::app_role)
    OR has_role(auth.uid(), 'financeiro'::app_role)
    OR has_role(auth.uid(), 'equipe'::app_role)
    OR has_role(auth.uid(), 'vendedor'::app_role)
  );

CREATE POLICY "Editar contratantes (gerente/financeiro)"
  ON public.contratantes FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'gerente'::app_role)
    OR has_role(auth.uid(), 'financeiro'::app_role)
  );

CREATE POLICY "Excluir contratantes (gerente)"
  ON public.contratantes FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'gerente'::app_role));

CREATE TRIGGER trg_contratantes_updated_at
  BEFORE UPDATE ON public.contratantes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Vínculo opcional show -> contratante
ALTER TABLE public.shows ADD COLUMN contratante_id uuid;
CREATE INDEX idx_shows_contratante_id ON public.shows(contratante_id);