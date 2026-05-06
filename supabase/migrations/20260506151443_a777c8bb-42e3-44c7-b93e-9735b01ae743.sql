CREATE TABLE public.whatsapp_pending_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  show_id uuid REFERENCES public.shows(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  descricao text,
  status text NOT NULL DEFAULT 'aguardando',
  resposta text,
  motivo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_whatsapp_pending_phone_status
  ON public.whatsapp_pending_actions (phone, status);

ALTER TABLE public.whatsapp_pending_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gerentes e diretores podem ver ações pendentes"
ON public.whatsapp_pending_actions
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'gerente'::public.app_role)
  OR public.has_role(auth.uid(), 'diretor'::public.app_role)
);

CREATE TRIGGER trg_whatsapp_pending_updated_at
BEFORE UPDATE ON public.whatsapp_pending_actions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();