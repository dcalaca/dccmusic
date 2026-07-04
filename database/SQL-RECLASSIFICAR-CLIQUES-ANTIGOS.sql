-- ============================================
-- Script para Reclassificar Cliques Antigos
-- ============================================
-- Este script reclassifica cliques que foram marcados como UNKNOWN
-- baseado no User-Agent e outros dados disponíveis

-- Função auxiliar para classificar baseado em User-Agent
CREATE OR REPLACE FUNCTION classify_click_from_ua(user_agent TEXT, referer TEXT, query_params TEXT DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
  ua_lower TEXT;
BEGIN
  IF user_agent IS NULL OR user_agent = '' THEN
    RETURN 'UNKNOWN';
  END IF;
  
  ua_lower := LOWER(user_agent);
  
  -- Padrões de bot conhecidos
  IF ua_lower LIKE '%facebookexternalhit%' OR
     ua_lower LIKE '%facebot%' OR
     ua_lower LIKE '%facebookcatalog%' OR
     ua_lower LIKE '%facebookplatform%' OR
     ua_lower LIKE '%twitterbot%' OR
     ua_lower LIKE '%telegrambot%' OR
     ua_lower LIKE '%slackbot%' OR
     ua_lower LIKE '%discordbot%' OR
     ua_lower LIKE '%linkedinbot%' OR
     ua_lower LIKE '%googlebot%' OR
     ua_lower LIKE '%bingbot%' OR
     ua_lower LIKE '%crawler%' OR
     ua_lower LIKE '%spider%' OR
     ua_lower LIKE '%bot%' OR
     ua_lower LIKE '%preview%' OR
     ua_lower LIKE '%scraper%' OR
     ua_lower LIKE '%fetcher%' THEN
    RETURN 'BOT_PREVIEW';
  END IF;
  
  -- Navegadores reais (deve conter Mozilla e um navegador conhecido)
  IF ua_lower LIKE '%mozilla%' AND (
     ua_lower LIKE '%chrome/%' OR
     ua_lower LIKE '%safari/%' OR
     ua_lower LIKE '%firefox/%' OR
     ua_lower LIKE '%edg/%' OR
     ua_lower LIKE '%opera/%' OR
     ua_lower LIKE '%opr/%') THEN
    RETURN 'HUMAN_CLICK';
  END IF;
  
  -- Instagram app pode ser humano ou bot, mas se tem referrer ou sinais de navegador é humano
  IF ua_lower LIKE '%instagram%' THEN
    IF referer IS NOT NULL AND referer != '' THEN
      RETURN 'HUMAN_CLICK';
    ELSIF ua_lower LIKE '%mozilla%' OR ua_lower LIKE '%chrome%' OR ua_lower LIKE '%safari%' THEN
      RETURN 'HUMAN_CLICK';
    ELSE
      -- Instagram app sem sinais claros - pode ser preview, mas sem mais info fica UNKNOWN
      RETURN 'UNKNOWN';
    END IF;
  END IF;
  
  -- WhatsApp - precisa análise mais cuidadosa
  IF ua_lower LIKE '%whatsapp%' THEN
    -- Se tem sinais de navegador (Mozilla, Chrome), é WebView humano
    IF ua_lower LIKE '%mozilla%' OR ua_lower LIKE '%chrome%' OR ua_lower LIKE '%safari%' THEN
      RETURN 'HUMAN_CLICK';
    END IF;
    
    -- Se User-Agent é só "WhatsApp/X.X.X.X" sem navegador
    -- Se tem referrer, pode ser humano (mas WhatsApp geralmente não envia referrer)
    -- Se tem query params (como fbclid), pode indicar navegação humana
    IF referer IS NOT NULL AND referer != '' THEN
      RETURN 'HUMAN_CLICK';
    END IF;
    
    IF query_params IS NOT NULL AND query_params != '' AND (LOWER(query_params) LIKE '%fbclid%' OR LOWER(query_params) LIKE '%utm_%') THEN
      RETURN 'HUMAN_CLICK';
    END IF;
    
    -- WhatsApp/2.x sem sinais de navegador e sem referrer geralmente é preview do bot
    RETURN 'BOT_PREVIEW';
  END IF;
  
  RETURN 'UNKNOWN';
END;
$$ LANGUAGE plpgsql;

-- Função para inferir origem
CREATE OR REPLACE FUNCTION infer_source_from_data(user_agent TEXT, referer TEXT)
RETURNS TEXT AS $$
DECLARE
  ua_lower TEXT;
  ref_lower TEXT;
BEGIN
  -- Primeiro tentar pelo referrer
  IF referer IS NOT NULL AND referer != '' THEN
    ref_lower := LOWER(referer);
    
    IF ref_lower LIKE '%whatsapp%' THEN
      RETURN 'WhatsApp';
    ELSIF ref_lower LIKE '%facebook%' OR ref_lower LIKE '%fb.com%' THEN
      RETURN 'Facebook';
    ELSIF ref_lower LIKE '%instagram%' THEN
      RETURN 'Instagram';
    ELSIF ref_lower LIKE '%twitter%' OR ref_lower LIKE '%x.com%' THEN
      RETURN 'Twitter/X';
    ELSIF ref_lower LIKE '%linkedin%' THEN
      RETURN 'LinkedIn';
    ELSIF ref_lower LIKE '%telegram%' THEN
      RETURN 'Telegram';
    END IF;
  END IF;
  
  -- Depois tentar pelo User-Agent
  IF user_agent IS NOT NULL AND user_agent != '' THEN
    ua_lower := LOWER(user_agent);
    
    IF ua_lower LIKE '%whatsapp%' THEN
      RETURN 'WhatsApp';
    ELSIF ua_lower LIKE '%instagram%' THEN
      RETURN 'Instagram';
    ELSIF ua_lower LIKE '%facebook%' THEN
      RETURN 'Facebook';
    ELSIF ua_lower LIKE '%twitter%' THEN
      RETURN 'Twitter/X';
    ELSIF ua_lower LIKE '%telegram%' THEN
      RETURN 'Telegram';
    ELSIF ua_lower LIKE '%linkedin%' THEN
      RETURN 'LinkedIn';
    ELSIF ua_lower LIKE '%slack%' THEN
      RETURN 'Slack';
    ELSIF ua_lower LIKE '%discord%' THEN
      RETURN 'Discord';
    END IF;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Reclassificar cliques UNKNOWN ou NULL
UPDATE dccmusic_link_clicks
SET 
  click_type = classify_click_from_ua(user_agent, referer, query_params),
  classification_reason = CASE
    WHEN LOWER(user_agent) LIKE '%facebookexternalhit%' THEN 'User-Agent contém padrão de bot: facebookexternalhit'
    WHEN LOWER(user_agent) LIKE '%facebot%' THEN 'User-Agent contém padrão de bot: facebot'
    WHEN LOWER(user_agent) LIKE '%twitterbot%' THEN 'User-Agent contém padrão de bot: twitterbot'
    WHEN LOWER(user_agent) LIKE '%telegrambot%' THEN 'User-Agent contém padrão de bot: telegrambot'
    WHEN LOWER(user_agent) LIKE '%bot%' AND LOWER(user_agent) NOT LIKE '%mozilla%' AND LOWER(user_agent) NOT LIKE '%chrome%' THEN 'User-Agent contém padrão de bot genérico'
    WHEN LOWER(user_agent) LIKE '%mozilla%' AND (LOWER(user_agent) LIKE '%chrome/%' OR LOWER(user_agent) LIKE '%safari/%' OR LOWER(user_agent) LIKE '%firefox/%' OR LOWER(user_agent) LIKE '%edg/%') THEN 'Navegador real detectado (Mozilla com navegador conhecido)'
    WHEN LOWER(user_agent) LIKE '%instagram%' AND (referer IS NOT NULL OR LOWER(user_agent) LIKE '%mozilla%' OR LOWER(user_agent) LIKE '%chrome%') THEN 'Instagram app/browser com sinais de navegação humana'
    WHEN LOWER(user_agent) LIKE '%whatsapp%' AND (LOWER(user_agent) LIKE '%mozilla%' OR LOWER(user_agent) LIKE '%chrome%') THEN 'WhatsApp WebView (clique humano)'
    WHEN LOWER(user_agent) LIKE '%whatsapp%' AND LOWER(user_agent) NOT LIKE '%mozilla%' AND LOWER(user_agent) NOT LIKE '%chrome%' AND (referer IS NOT NULL OR (query_params IS NOT NULL AND (LOWER(query_params) LIKE '%fbclid%' OR LOWER(query_params) LIKE '%utm_%'))) THEN 'WhatsApp com sinais de navegação humana (referrer ou query params)'
    WHEN LOWER(user_agent) LIKE '%whatsapp%' AND LOWER(user_agent) NOT LIKE '%mozilla%' AND LOWER(user_agent) NOT LIKE '%chrome%' THEN 'WhatsApp sem sinais de navegador (preview do bot)'
    WHEN LOWER(user_agent) LIKE '%instagram%' AND referer IS NULL AND LOWER(user_agent) NOT LIKE '%mozilla%' THEN 'Instagram app sem sinais claros de navegação'
    ELSE 'Reclassificação automática baseada em User-Agent'
  END,
  inferred_source = infer_source_from_data(user_agent, referer)
WHERE 
  click_type IS NULL 
  OR click_type = '' 
  OR click_type = 'UNKNOWN'
  OR classification_reason IS NULL
  OR classification_reason = 'Migração: classificação pendente';

-- Estatísticas após reclassificação
SELECT 
  click_type,
  COUNT(*) as total,
  COUNT(*) * 100.0 / (SELECT COUNT(*) FROM dccmusic_link_clicks) as percentage
FROM dccmusic_link_clicks
GROUP BY click_type
ORDER BY total DESC;

-- Limpar funções auxiliares (opcional, pode manter para uso futuro)
-- DROP FUNCTION IF EXISTS classify_click_from_ua(TEXT, TEXT, TEXT);
-- DROP FUNCTION IF EXISTS infer_source_from_data(TEXT, TEXT);
