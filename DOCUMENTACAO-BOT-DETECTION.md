# Documentação: Sistema de Detecção de Bots e Pré-visualizações

## Visão Geral

Este sistema classifica automaticamente cada clique em links rastreáveis em uma das três categorias:

- **BOT_PREVIEW**: Pré-visualizações/crawlers de redes sociais (WhatsApp, Facebook, Instagram, etc.)
- **HUMAN_CLICK**: Cliques reais de usuários humanos
- **UNKNOWN**: Não foi possível determinar com certeza

## Como Funciona

### 1. Classificação por User-Agent

O sistema analisa o User-Agent do request e verifica padrões conhecidos de bots:

#### Padrões de Bot Detectados

- **Facebook/Meta**: `facebookexternalhit`, `facebot`, `facebookcatalog`, `facebookplatform`
- **Twitter/X**: `twitterbot`, `twitter`
- **WhatsApp**: Requer análise adicional (pode ser WebView humano)
- **Telegram**: `telegrambot`, `telegram`
- **Outros**: `slackbot`, `discordbot`, `linkedinbot`, `googlebot`, `bingbot`, `crawler`, `spider`, `bot`, `preview`, etc.

#### Padrões de Navegador Real

O sistema verifica se o User-Agent contém padrões de navegadores reais:
- `Mozilla/5.0`
- `Chrome/`
- `Safari/`
- `Firefox/`
- `Edg/` (Edge)
- `Opera/`

### 2. Análise de Headers HTTP

Além do User-Agent, o sistema analisa headers HTTP para sinais de navegação humana:

- **Accept**: Deve conter `text/html` para navegação normal
- **Accept-Language**: Geralmente presente em navegadores reais
- **Accept-Encoding**: Geralmente presente
- **Referer**: Pode indicar navegação humana (mas não é obrigatório)

### 3. Detecção de Sequências (Preview → Clique Humano)

O sistema detecta quando um preview de bot é seguido por um clique humano do mesmo IP em uma janela de tempo (padrão: 10 minutos). Isso é comum em WhatsApp/Facebook:

1. Bot acessa o link para gerar preview (BOT_PREVIEW)
2. Usuário vê o preview e clica (HUMAN_CLICK)
3. Os dois cliques são relacionados via `related_preview_id`

### 4. Inferência de Origem

O sistema tenta inferir a origem do clique baseado em:

1. **Referrer** (prioridade): Analisa o domínio do referrer
2. **User-Agent**: Procura padrões conhecidos (WhatsApp, Instagram, etc.)

Origens suportadas:
- WhatsApp
- Facebook
- Instagram
- Twitter/X
- Telegram
- LinkedIn
- Slack
- Discord
- Messenger

## Geolocalização

O sistema faz lookup de geolocalização por IP usando APIs gratuitas:

- **ipapi.co**: 1000 requisições/dia (padrão)
- **ip-api.com**: 45 requisições/minuto

### Cache

Os resultados são cacheados por 24 horas para reduzir custos e melhorar performance.

### Privacidade (LGPD)

- IPs são mascarados automaticamente (ex: `192.168.1.0/24`)
- Campo `ip_masked` armazena o IP mascarado
- Campo `ip_address` mantém o IP completo (pode ser removido após período de retenção)

## Configuração

### Variáveis de Ambiente

```env
# Habilitar/desabilitar geolocalização (padrão: true)
GEO_API_ENABLED=true

# Provedor de geolocalização (padrão: ipapi)
GEO_API_PROVIDER=ipapi  # ou ipapi-com
```

## Como Atualizar a Lista de Bots

### 1. Adicionar Novo Padrão de Bot

Edite o arquivo `lib/bot-detector.ts` e adicione o padrão na lista `BOT_PATTERNS`:

```typescript
const BOT_PATTERNS = [
  // ... padrões existentes
  'novobot',  // Adicione aqui
]
```

### 2. Adicionar Nova Origem

Edite o arquivo `lib/bot-detector.ts` e adicione na lista `SOURCE_PATTERNS`:

```typescript
const SOURCE_PATTERNS: Array<{ pattern: RegExp; source: string }> = [
  // ... padrões existentes
  { pattern: /novaredesocial/i, source: 'Nova Rede Social' },
]
```

### 3. Ajustar Heurísticas

Se necessário, ajuste as funções:
- `isBotPattern()`: Lógica de detecção de bots
- `isHumanBrowser()`: Lógica de detecção de navegadores reais
- `analyzeHeaders()`: Análise de headers HTTP
- `classifyClick()`: Lógica principal de classificação

## Métricas no Painel

O painel de estatísticas mostra:

- **Total de Hits**: Todos os acessos (incluindo bots)
- **Cliques Humanos**: Apenas cliques reais
- **Pré-visualizações**: Bots/crawlers
- **Conversão Real**: Taxa baseada apenas em cliques humanos
- **Cliques Únicos Humanos**: IPs únicos que clicaram (humanos)

## Filtros Disponíveis

- **Tipo**: HUMAN_CLICK, BOT_PREVIEW, UNKNOWN
- **Dispositivo**: Desktop, Mobile, Tablet
- **Navegador**: Chrome, Firefox, Safari, etc.
- **Origem**: WhatsApp, Facebook, Instagram, etc.

## Exportação CSV

O painel permite exportar dados em CSV com todos os campos:
- Data/Hora
- Tipo (BOT_PREVIEW/HUMAN_CLICK/UNKNOWN)
- Motivo da classificação
- Origem inferida
- IP (mascarado)
- Dispositivo, Navegador, OS
- Localização (País, Cidade, Região)
- ISP, ASN
- Referer, User Agent

## Testes

Execute os testes unitários:

```bash
npm test lib/__tests__/bot-detector.test.ts
```

Os testes cobrem:
- Classificação de bots conhecidos
- Classificação de navegadores reais
- Detecção de WhatsApp (WebView vs Preview)
- Inferência de origem
- Detecção de sequências preview → clique humano

## Retenção de Dados (LGPD)

Recomenda-se implementar limpeza automática de logs antigos:

```sql
-- Exemplo: Remover logs com mais de 90 dias
DELETE FROM dccmusic_link_clicks
WHERE clicked_at < NOW() - INTERVAL '90 days'
AND click_type = 'BOT_PREVIEW';  -- Manter apenas humanos por mais tempo se necessário
```

Ou anonimizar IPs antigos:

```sql
-- Mascarar IPs antigos
UPDATE dccmusic_link_clicks
SET ip_address = NULL,
    ip_masked = SUBSTRING(ip_address::text, 1, POSITION('.' IN ip_address::text) + 2) || '0/24'
WHERE clicked_at < NOW() - INTERVAL '30 days';
```

## Troubleshooting

### Muitos cliques classificados como UNKNOWN

- Verifique se novos padrões de bot precisam ser adicionados
- Analise User-Agents dos cliques UNKNOWN
- Ajuste heurísticas se necessário

### Geolocalização não funcionando

- Verifique `GEO_API_ENABLED=true`
- Verifique limites da API escolhida
- Verifique logs de erro no console

### Performance lenta

- Verifique se o cache de geolocalização está funcionando
- Considere aumentar TTL do cache
- Considere fazer geolocalização assíncrona (já implementado)

## Estrutura do Banco de Dados

Novos campos adicionados em `dccmusic_link_clicks`:

- `click_type`: VARCHAR(20) - BOT_PREVIEW, HUMAN_CLICK, UNKNOWN
- `classification_reason`: TEXT - Motivo da classificação
- `inferred_source`: VARCHAR(100) - Origem inferida
- `related_preview_id`: UUID - ID do preview relacionado
- `asn`: VARCHAR(50) - ASN do IP
- `isp`: VARCHAR(255) - ISP do IP
- `latitude`: DECIMAL(10, 8) - Latitude
- `longitude`: DECIMAL(11, 8) - Longitude
- `ip_masked`: VARCHAR(50) - IP mascarado

## Migração

Execute o script SQL:

```bash
psql -d seu_banco -f SQL-ADICIONAR-CAMPOS-BOT-DETECTION.sql
```

Isso adicionará os novos campos e atualizará registros existentes para `UNKNOWN` (podem ser reclassificados depois).
