-- Track the exact signup origin for composer accounts.
-- Historical rows with a linked Google account are intentionally left NULL
-- because google_sub alone does not prove the account was originally created via Google.
ALTER TABLE public.dccmusic_composers
  ADD COLUMN IF NOT EXISTS signup_provider text;

ALTER TABLE public.dccmusic_composers
  DROP CONSTRAINT IF EXISTS dccmusic_composers_signup_provider_check;

ALTER TABLE public.dccmusic_composers
  ADD CONSTRAINT dccmusic_composers_signup_provider_check
  CHECK (signup_provider IS NULL OR signup_provider IN ('email', 'google'));

COMMENT ON COLUMN public.dccmusic_composers.signup_provider IS
  'Origem exata do cadastro da conta: email ou google. NULL em registros historicos ambiguos.';

UPDATE public.dccmusic_composers
SET signup_provider = 'email'
WHERE signup_provider IS NULL
  AND google_sub IS NULL
  AND email IS NOT NULL;
