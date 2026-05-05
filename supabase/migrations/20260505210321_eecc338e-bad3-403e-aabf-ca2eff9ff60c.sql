ALTER TABLE public.shows DROP CONSTRAINT shows_created_by_fkey;
ALTER TABLE public.shows ADD CONSTRAINT shows_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;