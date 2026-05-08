
-- contract_templates
CREATE TABLE public.contract_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  name text NOT NULL,
  content text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Diretor/Financeiro gerenciam templates contrato"
ON public.contract_templates
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'diretor'::public.app_role) OR public.has_role(auth.uid(), 'financeiro'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'diretor'::public.app_role) OR public.has_role(auth.uid(), 'financeiro'::public.app_role));

CREATE TRIGGER update_contract_templates_updated_at
BEFORE UPDATE ON public.contract_templates
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- contracts
CREATE TABLE public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  show_id uuid NOT NULL REFERENCES public.shows(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.contract_templates(id),
  content_snapshot text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  docusign_envelope_id text,
  docusign_envelope_url text,
  signed_pdf_url text,
  sold_by uuid NOT NULL REFERENCES auth.users(id),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  sent_at timestamptz,
  signed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_contracts_show_id ON public.contracts(show_id);
CREATE INDEX idx_contracts_sold_by ON public.contracts(sold_by);

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Diretor/Financeiro veem contratos"
ON public.contracts
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'diretor'::public.app_role) OR public.has_role(auth.uid(), 'financeiro'::public.app_role));

CREATE POLICY "Vendedor vê próprios contratos"
ON public.contracts
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'vendedor'::public.app_role) AND sold_by = auth.uid());

CREATE POLICY "Diretor/Financeiro inserem contratos"
ON public.contracts
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'diretor'::public.app_role) OR public.has_role(auth.uid(), 'financeiro'::public.app_role));

CREATE POLICY "Diretor/Financeiro atualizam contratos"
ON public.contracts
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'diretor'::public.app_role) OR public.has_role(auth.uid(), 'financeiro'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'diretor'::public.app_role) OR public.has_role(auth.uid(), 'financeiro'::public.app_role));

CREATE TRIGGER update_contracts_updated_at
BEFORE UPDATE ON public.contracts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
