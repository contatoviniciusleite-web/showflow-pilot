ALTER TABLE public.show_payments ALTER COLUMN valor TYPE numeric(15,2) USING round(valor::numeric, 2);
ALTER TABLE public.show_expenses ALTER COLUMN valor TYPE numeric(15,2) USING round(valor::numeric, 2);
ALTER TABLE public.shows ALTER COLUMN cache_total TYPE numeric(15,2) USING round(cache_total::numeric, 2);