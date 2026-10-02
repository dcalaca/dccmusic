ALTER TABLE public.dccmusic_composers ADD COLUMN IF NOT EXISTS google_sub text;
CREATE UNIQUE INDEX IF NOT EXISTS dccmusic_composers_google_sub_key ON public.dccmusic_composers (google_sub) WHERE google_sub IS NOT NULL;
