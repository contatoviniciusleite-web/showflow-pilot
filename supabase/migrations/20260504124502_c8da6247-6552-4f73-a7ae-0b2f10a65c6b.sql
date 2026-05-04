-- 1. Novas colunas em shows
ALTER TABLE public.shows
  ADD COLUMN IF NOT EXISTS autorizado_por_user_id uuid,
  ADD COLUMN IF NOT EXISTS autorizado_por_nome text,
  ADD COLUMN IF NOT EXISTS autorizado_em timestamptz;

-- 2. Trigger: apenas 1 Diretor
CREATE OR REPLACE FUNCTION public.enforce_single_diretor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'diretor'::public.app_role THEN
    IF EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE role = 'diretor'::public.app_role
        AND user_id <> NEW.user_id
    ) THEN
      RAISE EXCEPTION 'Já existe um Diretor cadastrado no sistema. Remova o atual antes de cadastrar um novo.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_single_diretor ON public.user_roles;
CREATE TRIGGER trg_enforce_single_diretor
  BEFORE INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_single_diretor();

-- 3. Políticas RLS atualizadas

-- shows
DROP POLICY IF EXISTS "Gerente e equipe atualizam shows" ON public.shows;
CREATE POLICY "Gerente, equipe e diretor atualizam shows"
ON public.shows FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'gerente'::app_role)
  OR has_role(auth.uid(), 'equipe'::app_role)
  OR has_role(auth.uid(), 'diretor'::app_role)
);

DROP POLICY IF EXISTS "Gerente exclui shows" ON public.shows;
CREATE POLICY "Gerente ou diretor excluem shows"
ON public.shows FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'gerente'::app_role)
  OR has_role(auth.uid(), 'diretor'::app_role)
);

DROP POLICY IF EXISTS "Gerente, equipe e vendedor criam shows" ON public.shows;
CREATE POLICY "Gerente, equipe, vendedor e diretor criam shows"
ON public.shows FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'gerente'::app_role)
  OR has_role(auth.uid(), 'equipe'::app_role)
  OR has_role(auth.uid(), 'vendedor'::app_role)
  OR has_role(auth.uid(), 'diretor'::app_role)
);

DROP POLICY IF EXISTS "Ver shows conforme papel" ON public.shows;
CREATE POLICY "Ver shows conforme papel"
ON public.shows FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'gerente'::app_role)
  OR has_role(auth.uid(), 'equipe'::app_role)
  OR has_role(auth.uid(), 'financeiro'::app_role)
  OR has_role(auth.uid(), 'diretor'::app_role)
  OR (has_role(auth.uid(), 'vendedor'::app_role) AND created_by = auth.uid())
  OR (has_role(auth.uid(), 'artista'::app_role) AND artist_id = get_my_artist_id())
);

-- contratantes
DROP POLICY IF EXISTS "Editar contratantes (gerente/financeiro)" ON public.contratantes;
CREATE POLICY "Editar contratantes (gerente/financeiro/diretor)"
ON public.contratantes FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'gerente'::app_role)
  OR has_role(auth.uid(), 'financeiro'::app_role)
  OR has_role(auth.uid(), 'diretor'::app_role)
);

DROP POLICY IF EXISTS "Excluir contratantes (gerente)" ON public.contratantes;
CREATE POLICY "Excluir contratantes (gerente/diretor)"
ON public.contratantes FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'gerente'::app_role)
  OR has_role(auth.uid(), 'diretor'::app_role)
);

DROP POLICY IF EXISTS "Inserir contratantes conforme papel" ON public.contratantes;
CREATE POLICY "Inserir contratantes conforme papel"
ON public.contratantes FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'gerente'::app_role)
  OR has_role(auth.uid(), 'financeiro'::app_role)
  OR has_role(auth.uid(), 'equipe'::app_role)
  OR has_role(auth.uid(), 'vendedor'::app_role)
  OR has_role(auth.uid(), 'diretor'::app_role)
);

DROP POLICY IF EXISTS "Ver contratantes conforme papel" ON public.contratantes;
CREATE POLICY "Ver contratantes conforme papel"
ON public.contratantes FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'gerente'::app_role)
  OR has_role(auth.uid(), 'financeiro'::app_role)
  OR has_role(auth.uid(), 'equipe'::app_role)
  OR has_role(auth.uid(), 'vendedor'::app_role)
  OR has_role(auth.uid(), 'diretor'::app_role)
);

-- show_payment_schedule
DROP POLICY IF EXISTS "Ver parcelas conforme papel" ON public.show_payment_schedule;
CREATE POLICY "Ver parcelas conforme papel"
ON public.show_payment_schedule FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM shows s
    WHERE s.id = show_payment_schedule.show_id AND (
      has_role(auth.uid(), 'gerente'::app_role)
      OR has_role(auth.uid(), 'equipe'::app_role)
      OR has_role(auth.uid(), 'financeiro'::app_role)
      OR has_role(auth.uid(), 'diretor'::app_role)
      OR (has_role(auth.uid(), 'vendedor'::app_role) AND s.created_by = auth.uid())
      OR (has_role(auth.uid(), 'artista'::app_role) AND s.artist_id = get_my_artist_id())
    )
  )
);

DROP POLICY IF EXISTS "Gerenciar parcelas conforme papel" ON public.show_payment_schedule;
CREATE POLICY "Gerenciar parcelas conforme papel"
ON public.show_payment_schedule FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM shows s
    WHERE s.id = show_payment_schedule.show_id AND (
      has_role(auth.uid(), 'gerente'::app_role)
      OR has_role(auth.uid(), 'equipe'::app_role)
      OR has_role(auth.uid(), 'financeiro'::app_role)
      OR has_role(auth.uid(), 'diretor'::app_role)
      OR (has_role(auth.uid(), 'vendedor'::app_role) AND s.created_by = auth.uid())
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM shows s
    WHERE s.id = show_payment_schedule.show_id AND (
      has_role(auth.uid(), 'gerente'::app_role)
      OR has_role(auth.uid(), 'equipe'::app_role)
      OR has_role(auth.uid(), 'financeiro'::app_role)
      OR has_role(auth.uid(), 'diretor'::app_role)
      OR (has_role(auth.uid(), 'vendedor'::app_role) AND s.created_by = auth.uid())
    )
  )
);

-- show_payments
DROP POLICY IF EXISTS "Ver pagamentos conforme papel" ON public.show_payments;
CREATE POLICY "Ver pagamentos conforme papel"
ON public.show_payments FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'gerente'::app_role)
  OR has_role(auth.uid(), 'equipe'::app_role)
  OR has_role(auth.uid(), 'financeiro'::app_role)
  OR has_role(auth.uid(), 'diretor'::app_role)
  OR EXISTS (SELECT 1 FROM shows s WHERE s.id = show_payments.show_id AND s.created_by = auth.uid())
);

-- show_attachments
DROP POLICY IF EXISTS "Ver anexos conforme papel" ON public.show_attachments;
CREATE POLICY "Ver anexos conforme papel"
ON public.show_attachments FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'gerente'::app_role)
  OR has_role(auth.uid(), 'financeiro'::app_role)
  OR has_role(auth.uid(), 'equipe'::app_role)
  OR has_role(auth.uid(), 'diretor'::app_role)
  OR uploaded_by = auth.uid()
);

-- show_expenses
DROP POLICY IF EXISTS "Ver despesas conforme papel" ON public.show_expenses;
CREATE POLICY "Ver despesas conforme papel"
ON public.show_expenses FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM shows s WHERE s.id = show_expenses.show_id AND (
    has_role(auth.uid(), 'gerente'::app_role)
    OR has_role(auth.uid(), 'equipe'::app_role)
    OR has_role(auth.uid(), 'financeiro'::app_role)
    OR has_role(auth.uid(), 'diretor'::app_role)
    OR (has_role(auth.uid(), 'artista'::app_role) AND s.artist_id = get_my_artist_id())
  ))
);

-- show_deposits
DROP POLICY IF EXISTS "Ver depósitos conforme papel" ON public.show_deposits;
CREATE POLICY "Ver depósitos conforme papel"
ON public.show_deposits FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM shows s WHERE s.id = show_deposits.show_id AND (
    has_role(auth.uid(), 'gerente'::app_role)
    OR has_role(auth.uid(), 'equipe'::app_role)
    OR has_role(auth.uid(), 'financeiro'::app_role)
    OR has_role(auth.uid(), 'diretor'::app_role)
    OR (has_role(auth.uid(), 'artista'::app_role) AND s.artist_id = get_my_artist_id())
  ))
);

-- show_reschedules
DROP POLICY IF EXISTS "Ver remarcacoes conforme papel" ON public.show_reschedules;
CREATE POLICY "Ver remarcacoes conforme papel"
ON public.show_reschedules FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'gerente'::app_role)
  OR has_role(auth.uid(), 'financeiro'::app_role)
  OR has_role(auth.uid(), 'equipe'::app_role)
  OR has_role(auth.uid(), 'diretor'::app_role)
  OR EXISTS (SELECT 1 FROM shows s WHERE s.id = show_reschedules.show_id AND has_role(auth.uid(), 'artista'::app_role) AND s.artist_id = get_my_artist_id())
);

-- artists
DROP POLICY IF EXISTS "Gerente gerencia artistas" ON public.artists;
CREATE POLICY "Gerente ou diretor gerenciam artistas"
ON public.artists FOR ALL TO authenticated
USING (has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'diretor'::app_role))
WITH CHECK (has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'diretor'::app_role));

-- user_roles
DROP POLICY IF EXISTS "Gerente gerencia papéis" ON public.user_roles;
CREATE POLICY "Gerente ou diretor gerenciam papéis"
ON public.user_roles FOR ALL TO authenticated
USING (has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'diretor'::app_role))
WITH CHECK (has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'diretor'::app_role));

DROP POLICY IF EXISTS "Ver próprios papéis" ON public.user_roles;
CREATE POLICY "Ver próprios papéis"
ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'diretor'::app_role));

-- vendedor_artists
DROP POLICY IF EXISTS "Gerente gerencia vendedor_artists" ON public.vendedor_artists;
CREATE POLICY "Gerente ou diretor gerenciam vendedor_artists"
ON public.vendedor_artists FOR ALL TO authenticated
USING (has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'diretor'::app_role))
WITH CHECK (has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'diretor'::app_role));

-- blocked_dates
DROP POLICY IF EXISTS "Gerente gerencia bloqueios" ON public.blocked_dates;
CREATE POLICY "Gerente ou diretor gerenciam bloqueios"
ON public.blocked_dates FOR ALL TO authenticated
USING (has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'diretor'::app_role))
WITH CHECK (has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'diretor'::app_role));

-- profiles
DROP POLICY IF EXISTS "Usuário vê próprio perfil" ON public.profiles;
CREATE POLICY "Usuário vê próprio perfil ou gestão"
ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = id OR has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'diretor'::app_role));

-- notifications
DROP POLICY IF EXISTS "Gerente gerencia notificações" ON public.notifications;
CREATE POLICY "Gerente ou diretor gerenciam notificações"
ON public.notifications FOR ALL TO authenticated
USING (has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'diretor'::app_role))
WITH CHECK (has_role(auth.uid(), 'gerente'::app_role) OR has_role(auth.uid(), 'diretor'::app_role));