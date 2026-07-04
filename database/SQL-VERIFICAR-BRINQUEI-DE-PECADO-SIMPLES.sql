  -- ============================================
  -- SQL SIMPLIFICADO PARA VERIFICAR O VÍDEO "BRINQUEI DE PECADO"
  -- DCC Music - Execute no SQL Editor do Supabase
  -- ============================================

  -- QUERY 1: Detalhes do vídeo "Brinquei de Pecado"
  SELECT 
    id,
    title,
    slug,
    genre,
    published_at,
    created_at,
    updated_at,
    featured,
    youtube_id,
    CASE 
      WHEN published_at IS NULL THEN '❌ published_at é NULL'
      WHEN published_at > NOW() THEN '⚠️ published_at é futuro'
      ELSE '✅ published_at OK'
    END as status_published_at
  FROM dccmusic_videos
  WHERE id = '2b48c182-42bf-447a-b76d-0a7115dc5aaf'
    OR title ILIKE '%brinquei%pecado%';

  -- QUERY 2: Comparar com outros vídeos Sertanejo
  SELECT 
    id,
    title,
    genre,
    published_at,
    created_at,
    CASE 
      WHEN published_at IS NULL THEN 'NULL'
      WHEN published_at > NOW() THEN 'FUTURO'
      ELSE 'OK'
    END as status_published
  FROM dccmusic_videos
  WHERE genre = 'Sertanejo'
  ORDER BY published_at DESC NULLS LAST;

  -- QUERY 3: Verificar diferenças nas datas de publicação
  WITH video_composer_counts AS (
    SELECT 
      v.id,
      v.title,
      v.published_at,
      COUNT(vc.composer_id) as num_compositores
    FROM dccmusic_videos v
    LEFT JOIN dccmusic_video_composers vc ON v.id = vc.video_id
    GROUP BY v.id, v.title, v.published_at
  )
  SELECT 
    CASE 
      WHEN num_compositores = 0 THEN 'Sem Compositores'
      WHEN num_compositores = 1 THEN '1 Compositor'
      ELSE 'Múltiplos Compositores'
    END as tipo,
    COUNT(*) as total,
    MIN(published_at) as published_at_min,
    MAX(published_at) as published_at_max,
    COUNT(CASE WHEN published_at IS NULL THEN 1 END) as sem_published_at,
    COUNT(CASE WHEN published_at > NOW() THEN 1 END) as published_futuro
  FROM video_composer_counts
  GROUP BY 
    CASE 
      WHEN num_compositores = 0 THEN 'Sem Compositores'
      WHEN num_compositores = 1 THEN '1 Compositor'
      ELSE 'Múltiplos Compositores'
    END
  ORDER BY total DESC;

  -- QUERY 4: Testar query similar à função getVideos() com filtro Sertanejo
  SELECT 
    id,
    title,
    genre,
    published_at,
    created_at
  FROM dccmusic_videos
  WHERE genre = 'Sertanejo'
  ORDER BY published_at DESC NULLS LAST;

  -- QUERY 5: Testar query com filtro IN (como quando todos os gêneros estão selecionados)
  SELECT 
    id,
    title,
    genre,
    published_at,
    created_at
  FROM dccmusic_videos
  WHERE genre IN ('Sertanejo', 'Funk', 'HipHop', 'Forró', 'Axé', 'Pop', 'MPB')
  ORDER BY published_at DESC NULLS LAST
  LIMIT 15;

  -- ============================================
  -- SOLUÇÃO RÁPIDA (se published_at for NULL):
  -- ============================================
  -- Execute esta query se o published_at estiver NULL:
  --
  -- UPDATE dccmusic_videos 
  -- SET published_at = created_at 
  -- WHERE id = '2b48c182-42bf-447a-b76d-0a7115dc5aaf' AND published_at IS NULL;
  --
  -- Ou se published_at for futuro:
  --
  -- UPDATE dccmusic_videos 
  -- SET published_at = created_at 
  -- WHERE id = '2b48c182-42bf-447a-b76d-0a7115dc5aaf' AND published_at > NOW();
  -- ============================================
