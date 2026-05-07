ALTER TABLE public.shows
  ADD COLUMN IF NOT EXISTS confirmado_sem_pagamento boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS confirmado_sem_pagamento_motivo text;