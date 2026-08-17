-- Transforma ouvintes (dccmusic_site_users) que ainda NÃO têm compositor
-- em contas de compositor, com pseudônimo e a mesma senha.
-- Quem já tem compositor com o mesmo e-mail NÃO é duplicado.
-- A tabela de ouvintes continua existindo por causa dos comentários.

DO $$
DECLARE
  rec record;
  artist_name text;
  base_name text;
  artist_slug text;
  base_slug text;
  n int;
BEGIN
  FOR rec IN
    SELECT su.email, su.name, su.password_hash, su.created_at
    FROM dccmusic_site_users su
    WHERE su.email IS NOT NULL
      AND btrim(su.email) <> ''
      AND NOT EXISTS (
        SELECT 1
        FROM dccmusic_composers c
        WHERE lower(c.email) = lower(su.email)
      )
    ORDER BY su.created_at
  LOOP
    base_name := initcap(btrim(coalesce(rec.name, '')));
    IF base_name IS NULL OR base_name = '' THEN
      base_name := split_part(lower(rec.email), '@', 1);
    END IF;

    artist_name := base_name;
    n := 0;
    WHILE EXISTS (
      SELECT 1 FROM dccmusic_composers c WHERE lower(c.name) = lower(artist_name)
    ) LOOP
      n := n + 1;
      artist_name := base_name || ' ' || split_part(lower(rec.email), '@', 1);
      IF n > 1 THEN
        artist_name := artist_name || ' ' || n::text;
      END IF;
    END LOOP;

    base_slug := lower(regexp_replace(
      translate(
        lower(artist_name),
        'áàâãäéèêëíìîïóòôõöúùûüç',
        'aaaaaeeeeiiiioooooouuuuc'
      ),
      '[^a-z0-9]+',
      '-',
      'g'
    ));
    base_slug := trim(both '-' from base_slug);
    IF base_slug IS NULL OR base_slug = '' THEN
      base_slug := 'compositor';
    END IF;

    artist_slug := base_slug;
    n := 0;
    WHILE EXISTS (
      SELECT 1 FROM dccmusic_composers c WHERE c.slug = artist_slug
    ) LOOP
      n := n + 1;
      artist_slug := base_slug || '-' || n::text;
    END LOOP;

    INSERT INTO dccmusic_composers (
      name,
      slug,
      email,
      password_hash,
      account_name,
      email_verified,
      email_verified_at,
      is_premium,
      has_active_subscription,
      role,
      created_at
    ) VALUES (
      artist_name,
      artist_slug,
      lower(btrim(rec.email)),
      rec.password_hash,
      base_name,
      true,
      now(),
      false,
      false,
      'user',
      rec.created_at
    );
  END LOOP;
END $$;
