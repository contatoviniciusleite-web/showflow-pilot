CREATE OR REPLACE FUNCTION public.log_show_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  uname text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT nome INTO uname FROM public.profiles WHERE id = uid;
    INSERT INTO public.show_status_history (show_id, status_anterior, status_novo, motivo, changed_by, changed_by_nome)
    VALUES (NEW.id, NULL, NEW.status::text, 'Minuta criada', uid, uname);
    RETURN NEW;
  END IF;

  SELECT nome INTO uname FROM public.profiles WHERE id = uid;

  -- Mudança de status
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.show_status_history (show_id, status_anterior, status_novo, motivo, changed_by, changed_by_nome)
    VALUES (
      NEW.id, OLD.status::text, NEW.status::text,
      COALESCE(NEW.cancelado_motivo, NEW.rejeitada_motivo, NEW.ultima_remarcacao_motivo),
      uid, uname
    );
  END IF;

  -- Link enviado ao contratante
  IF NEW.contratante_link_token IS DISTINCT FROM OLD.contratante_link_token AND NEW.contratante_link_token IS NOT NULL THEN
    INSERT INTO public.show_status_history (show_id, status_anterior, status_novo, motivo, changed_by, changed_by_nome)
    VALUES (NEW.id, NEW.status::text, NEW.status::text, '📩 Link enviado ao contratante', uid, uname);
  END IF;

  -- Contratante preencheu o link
  IF NEW.contratante_link_preenchido_em IS DISTINCT FROM OLD.contratante_link_preenchido_em AND NEW.contratante_link_preenchido_em IS NOT NULL THEN
    INSERT INTO public.show_status_history (show_id, status_anterior, status_novo, motivo, changed_by, changed_by_nome)
    VALUES (NEW.id, NEW.status::text, NEW.status::text, '✅ Contratante preencheu os dados', NULL, NEW.contratante_nome);
  END IF;

  -- Dados completos
  IF NEW.dados_completos_em IS DISTINCT FROM OLD.dados_completos_em AND NEW.dados_completos_em IS NOT NULL THEN
    INSERT INTO public.show_status_history (show_id, status_anterior, status_novo, motivo, changed_by, changed_by_nome)
    VALUES (NEW.id, NEW.status::text, NEW.status::text, 'Dados completos preenchidos', uid, uname);
  END IF;

  -- Comprovante enviado
  IF NEW.comprovante_enviado_em IS DISTINCT FROM OLD.comprovante_enviado_em AND NEW.comprovante_enviado_em IS NOT NULL THEN
    INSERT INTO public.show_status_history (show_id, status_anterior, status_novo, motivo, changed_by, changed_by_nome)
    VALUES (
      NEW.id, NEW.status::text, NEW.status::text, '📎 Comprovante de pagamento enviado',
      NEW.comprovante_enviado_por,
      (SELECT nome FROM public.profiles p WHERE p.id = NEW.comprovante_enviado_por)
    );
  END IF;

  -- Autorização excepcional (cachê abaixo do mínimo)
  IF NEW.autorizado_em IS DISTINCT FROM OLD.autorizado_em AND NEW.autorizado_em IS NOT NULL THEN
    INSERT INTO public.show_status_history (show_id, status_anterior, status_novo, motivo, changed_by, changed_by_nome)
    VALUES (
      NEW.id, NEW.status::text, NEW.status::text,
      'Cachê abaixo do mínimo autorizado por ' || COALESCE(NEW.autorizado_por_nome, NEW.autorizado_por, '—'),
      NEW.autorizado_por_user_id,
      COALESCE(NEW.autorizado_por_nome, (SELECT nome FROM public.profiles p WHERE p.id = NEW.autorizado_por_user_id))
    );
  END IF;

  -- Remarcação (incrementou contagem)
  IF NEW.ultima_remarcacao_em IS DISTINCT FROM OLD.ultima_remarcacao_em AND NEW.ultima_remarcacao_em IS NOT NULL THEN
    INSERT INTO public.show_status_history (show_id, status_anterior, status_novo, motivo, changed_by, changed_by_nome)
    VALUES (
      NEW.id, NEW.status::text, NEW.status::text,
      'Show remarcado: ' || COALESCE(NEW.ultima_remarcacao_motivo, '—'),
      NEW.ultima_remarcacao_por,
      (SELECT nome FROM public.profiles p WHERE p.id = NEW.ultima_remarcacao_por)
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Recria o trigger sem restrição de coluna
DROP TRIGGER IF EXISTS trg_log_show_status_change ON public.shows;
CREATE TRIGGER trg_log_show_status_change
AFTER INSERT OR UPDATE ON public.shows
FOR EACH ROW
EXECUTE FUNCTION public.log_show_status_change();