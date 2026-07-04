-- ============================================
-- SQL PARA VERIFICAR COMPOSITORES COM NOMES SIMILARES
-- DCC Music - Execute no Supabase SQL Editor
-- ============================================
-- Este script ajuda a identificar compositores com nomes duplicados/similares
-- que podem ter sido criados por variações de acentuação
-- ============================================

-- Função auxiliar para normalizar nomes (remove acentos)
CREATE OR REPLACE FUNCTION normalize_text(text_value TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN lower(
    translate(
      text_value,
      'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
      'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Verificar compositores com nomes similares (normalizados)
SELECT 
  normalize_text(name) as nome_normalizado,
  array_agg(name ORDER BY created_at) as nomes_originais,
  array_agg(id::text ORDER BY created_at) as ids,
  COUNT(*) as quantidade
FROM dccmusic_composers
GROUP BY normalize_text(name)
HAVING COUNT(*) > 1
ORDER BY quantidade DESC, nome_normalizado;

-- Ver compositores individuais para análise
SELECT 
  id,
  name,
  email,
  slug,
  normalize_text(name) as nome_normalizado,
  created_at
FROM dccmusic_composers
ORDER BY normalize_text(name), created_at;

-- Exemplo: Verificar se "Douglas Calaça" e "Douglas Calaca" existem
SELECT 
  id,
  name,
  email,
  normalize_text(name) as nome_normalizado
FROM dccmusic_composers
WHERE normalize_text(name) LIKE normalize_text('%Douglas%Calac%')
ORDER BY created_at;
