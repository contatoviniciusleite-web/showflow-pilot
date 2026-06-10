ALTER TABLE public.shows ALTER COLUMN artist_id DROP NOT NULL;
ALTER TABLE public.shows DROP CONSTRAINT shows_artist_id_fkey;
ALTER TABLE public.shows ADD CONSTRAINT shows_artist_id_fkey FOREIGN KEY (artist_id) REFERENCES public.artists(id) ON DELETE SET NULL;

ALTER TABLE public.weekly_closings ALTER COLUMN artist_id DROP NOT NULL;
ALTER TABLE public.weekly_closings DROP CONSTRAINT weekly_closings_artist_id_fkey;
ALTER TABLE public.weekly_closings ADD CONSTRAINT weekly_closings_artist_id_fkey FOREIGN KEY (artist_id) REFERENCES public.artists(id) ON DELETE SET NULL;