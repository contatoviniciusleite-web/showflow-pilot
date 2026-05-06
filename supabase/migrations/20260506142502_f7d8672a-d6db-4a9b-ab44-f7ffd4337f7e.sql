-- Limpa backfill anterior simples
DELETE FROM public.show_status_history
WHERE motivo = 'Registro inicial (backfill)';

-- Helper para obter nome do profile
-- (inline via subselect)

-- 1) Criação da minuta
INSERT INTO public.show_status_history (show_id, status_anterior, status_novo, motivo, changed_by, changed_by_nome, changed_at)
SELECT s.id, NULL, 'pendente', 'Minuta criada', s.created_by,
       (SELECT nome FROM public.profiles p WHERE p.id = s.created_by),
       s.created_at
FROM public.shows s
WHERE NOT EXISTS (
  SELECT 1 FROM public.show_status_history h
  WHERE h.show_id = s.id AND h.motivo = 'Minuta criada'
);

-- 2) Aprovação
INSERT INTO public.show_status_history (show_id, status_anterior, status_novo, motivo, changed_by, changed_by_nome, changed_at)
SELECT s.id, 'pendente', 'aprovada',
       CASE WHEN s.auto_aprovado THEN 'Aprovação automática' ELSE 'Minuta aprovada' END,
       s.aprovado_por,
       (SELECT nome FROM public.profiles p WHERE p.id = s.aprovado_por),
       s.aprovado_em
FROM public.shows s
WHERE s.aprovado_em IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.show_status_history h WHERE h.show_id = s.id AND h.changed_at = s.aprovado_em AND h.status_novo = 'aprovada');

-- 3) Rejeição
INSERT INTO public.show_status_history (show_id, status_anterior, status_novo, motivo, changed_by, changed_by_nome, changed_at)
SELECT s.id, 'pendente', 'rejeitada',
       COALESCE(s.rejeitada_motivo, 'Minuta rejeitada'),
       s.rejeitada_por,
       (SELECT nome FROM public.profiles p WHERE p.id = s.rejeitada_por),
       s.rejeitada_em
FROM public.shows s
WHERE s.rejeitada_em IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.show_status_history h WHERE h.show_id = s.id AND h.changed_at = s.rejeitada_em AND h.status_novo = 'rejeitada');

-- 4) Link enviado ao contratante
INSERT INTO public.show_status_history (show_id, status_anterior, status_novo, motivo, changed_at)
SELECT s.id, 'aprovada', 'aprovada', '📩 Link enviado ao contratante',
       COALESCE(s.aprovado_em, s.created_at)
FROM public.shows s
WHERE s.contratante_link_token IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.show_status_history h WHERE h.show_id = s.id AND h.motivo = '📩 Link enviado ao contratante');

-- 5) Contratante preencheu o link
INSERT INTO public.show_status_history (show_id, status_anterior, status_novo, motivo, changed_at)
SELECT s.id, 'aprovada', 'aprovada', '✅ Contratante preencheu os dados',
       s.contratante_link_preenchido_em
FROM public.shows s
WHERE s.contratante_link_preenchido_em IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.show_status_history h WHERE h.show_id = s.id AND h.motivo = '✅ Contratante preencheu os dados');

-- 6) Dados completos (passou para aguardando_pagamento)
INSERT INTO public.show_status_history (show_id, status_anterior, status_novo, motivo, changed_at)
SELECT s.id, 'aprovada', 'aguardando_pagamento', 'Dados completos — aguardando pagamento',
       s.dados_completos_em
FROM public.shows s
WHERE s.dados_completos_em IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.show_status_history h WHERE h.show_id = s.id AND h.changed_at = s.dados_completos_em AND h.status_novo = 'aguardando_pagamento');

-- 7) Autorizado (cachê abaixo do mínimo)
INSERT INTO public.show_status_history (show_id, status_anterior, status_novo, motivo, changed_by, changed_by_nome, changed_at)
SELECT s.id, NULL, s.status::text,
       'Cachê abaixo do mínimo autorizado por ' || COALESCE(s.autorizado_por_nome, s.autorizado_por, '—'),
       s.autorizado_por_user_id,
       COALESCE(s.autorizado_por_nome, (SELECT nome FROM public.profiles p WHERE p.id = s.autorizado_por_user_id)),
       s.autorizado_em
FROM public.shows s
WHERE s.autorizado_em IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.show_status_history h WHERE h.show_id = s.id AND h.changed_at = s.autorizado_em AND h.motivo LIKE 'Cachê abaixo%');

-- 8) Comprovante enviado
INSERT INTO public.show_status_history (show_id, status_anterior, status_novo, motivo, changed_by, changed_by_nome, changed_at)
SELECT s.id, 'aguardando_pagamento', 'aguardando_pagamento', '📎 Comprovante enviado',
       s.comprovante_enviado_por,
       (SELECT nome FROM public.profiles p WHERE p.id = s.comprovante_enviado_por),
       s.comprovante_enviado_em
FROM public.shows s
WHERE s.comprovante_enviado_em IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.show_status_history h WHERE h.show_id = s.id AND h.motivo = '📎 Comprovante enviado');

-- 9) Confirmação de pagamento
INSERT INTO public.show_status_history (show_id, status_anterior, status_novo, motivo, changed_by, changed_by_nome, changed_at)
SELECT s.id, 'aguardando_pagamento', 'confirmado', 'Pagamento confirmado',
       s.confirmado_por,
       COALESCE(s.confirmado_por_nome, (SELECT nome FROM public.profiles p WHERE p.id = s.confirmado_por)),
       s.confirmado_em
FROM public.shows s
WHERE s.confirmado_em IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.show_status_history h WHERE h.show_id = s.id AND h.changed_at = s.confirmado_em AND h.status_novo = 'confirmado');

-- 10) Cancelamento
INSERT INTO public.show_status_history (show_id, status_anterior, status_novo, motivo, changed_at)
SELECT s.id, NULL, 'cancelada', COALESCE(s.cancelado_motivo, 'Show cancelado'),
       s.cancelado_em
FROM public.shows s
WHERE s.cancelado_em IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.show_status_history h WHERE h.show_id = s.id AND h.changed_at = s.cancelado_em AND h.status_novo = 'cancelada');

-- 11) Remarcações (a partir de show_reschedules)
INSERT INTO public.show_status_history (show_id, status_anterior, status_novo, motivo, changed_by, changed_by_nome, changed_at)
SELECT r.show_id, NULL, 'remarcado',
       'Remarcado de ' || to_char(r.data_anterior, 'DD/MM/YYYY')
         || COALESCE(' ' || to_char(r.horario_anterior, 'HH24:MI'), '')
         || ' para ' || to_char(r.data_nova, 'DD/MM/YYYY')
         || COALESCE(' ' || to_char(r.horario_novo, 'HH24:MI'), '')
         || ' — ' || r.motivo,
       r.remarcado_por,
       COALESCE(r.remarcado_por_nome, (SELECT nome FROM public.profiles p WHERE p.id = r.remarcado_por)),
       r.created_at
FROM public.show_reschedules r
WHERE NOT EXISTS (
  SELECT 1 FROM public.show_status_history h
  WHERE h.show_id = r.show_id AND h.changed_at = r.created_at AND h.status_novo = 'remarcado'
);