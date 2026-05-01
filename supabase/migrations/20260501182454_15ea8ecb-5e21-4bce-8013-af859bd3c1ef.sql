
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'financeiro';
ALTER TYPE public.show_status ADD VALUE IF NOT EXISTS 'aguardando_pagamento';
ALTER TYPE public.show_status ADD VALUE IF NOT EXISTS 'comprovante_enviado';
ALTER TYPE public.show_status ADD VALUE IF NOT EXISTS 'confirmado';
ALTER TYPE public.show_status ADD VALUE IF NOT EXISTS 'cancelada';
