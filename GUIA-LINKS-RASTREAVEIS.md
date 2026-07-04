# Guia de Uso - Sistema de Links Rastreáveis

Este sistema permite criar links rastreáveis que redirecionam para URLs de destino e registram informações sobre cada clique.

## 📋 Pré-requisitos

1. Execute o script SQL para criar as tabelas:
   ```sql
   -- Execute o arquivo SQL-CRIAR-SISTEMA-LINKS-RASTREAVEIS.sql no Supabase
   ```

## 🚀 Como Usar

### 1. Criar um Link Rastreável

**Endpoint:** `POST /api/links/create`

**Body:**
```json
{
  "title": "Link para meu site",
  "destinationUrl": "https://meusite.com",
  "createdBy": "usuario@email.com", // Opcional
  "notes": "Link para campanha X", // Opcional
  "expiresAt": "2025-12-31T23:59:59Z" // Opcional
}
```

**Resposta:**
```json
{
  "id": "uuid-do-link",
  "title": "Link para meu site",
  "destinationUrl": "https://meusite.com",
  "shortCode": "abc12345",
  "trackedUrl": "https://seusite.com/l/abc12345",
  "clickCount": 0,
  "createdAt": "2025-02-04T10:00:00Z",
  ...
}
```

**Exemplo com cURL:**
```bash
curl -X POST http://localhost:3000/api/links/create \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Link para meu site",
    "destinationUrl": "https://meusite.com",
    "createdBy": "usuario@email.com"
  }'
```

### 2. Usar o Link Rastreável

Quando alguém acessar `https://seusite.com/l/abc12345`, o sistema:
- Registra automaticamente o clique (IP, navegador, referer, etc.)
- Redireciona para a URL de destino
- Atualiza o contador de cliques

### 3. Ver Estatísticas de um Link

**Endpoint:** `GET /api/links/[shortCode]`

**Exemplo:**
```bash
curl http://localhost:3000/api/links/abc12345
```

**Resposta:**
```json
{
  "id": "uuid-do-link",
  "title": "Link para meu site",
  "destinationUrl": "https://meusite.com",
  "shortCode": "abc12345",
  "clickCount": 42,
  "totalClicks": 42,
  "uniqueClicks": 35,
  "clicks": [
    {
      "id": "uuid-do-clique",
      "ipAddress": "192.168.1.1",
      "userAgent": "Mozilla/5.0...",
      "referer": "https://google.com",
      "clickedAt": "2025-02-04T10:30:00Z",
      "country": null,
      "city": null
    },
    ...
  ],
  ...
}
```

### 4. Listar Todos os Links de um Criador

**Endpoint:** `GET /api/links/list?createdBy=usuario@email.com`

**Exemplo:**
```bash
curl "http://localhost:3000/api/links/list?createdBy=usuario@email.com"
```

### 5. Atualizar um Link

**Endpoint:** `PUT /api/links/[shortCode]`

**Body:**
```json
{
  "title": "Novo título",
  "destinationUrl": "https://novosite.com",
  "notes": "Atualizado",
  "isActive": true
}
```

### 6. Deletar um Link

**Endpoint:** `DELETE /api/links/[shortCode]`

## 📊 Informações Rastreadas

Para cada clique, o sistema registra:
- **IP Address**: Endereço IP de quem clicou
- **User Agent**: Navegador e dispositivo usado
- **Referer**: De onde veio o clique (se disponível)
- **Data/Hora**: Quando o clique ocorreu
- **País/Cidade**: (Opcional, pode ser preenchido depois com serviços externos)

## 🔒 Segurança

- Links podem ser desativados (`isActive: false`)
- Links podem ter data de expiração
- RLS (Row Level Security) está configurado no banco de dados
- Ajuste as políticas RLS conforme sua necessidade de autenticação

## 💡 Exemplos de Uso

### Criar link via JavaScript/TypeScript

```typescript
async function criarLinkRastreavel() {
  const response = await fetch('/api/links/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: 'Link para campanha de marketing',
      destinationUrl: 'https://meusite.com/promocao',
      createdBy: 'marketing@empresa.com',
      notes: 'Campanha Q1 2025',
    }),
  })
  
  const link = await response.json()
  console.log('Link criado:', link.trackedUrl)
  return link.trackedUrl
}
```

### Verificar estatísticas

```typescript
async function verEstatisticas(shortCode: string) {
  const response = await fetch(`/api/links/${shortCode}`)
  const stats = await response.json()
  
  console.log(`Total de cliques: ${stats.totalClicks}`)
  console.log(`Cliques únicos: ${stats.uniqueClicks}`)
  console.log(`Últimos cliques:`, stats.clicks.slice(0, 10))
}
```

## 🎯 Próximos Passos

1. Execute o script SQL no Supabase
2. Teste criando um link via API
3. Acesse o link gerado para testar o redirecionamento
4. Verifique as estatísticas do link criado
5. (Opcional) Crie uma interface web para gerenciar os links

## 📝 Notas

- O código curto gerado tem 8 caracteres (letras e números)
- Links expirados não funcionam (retornam 404)
- Links desativados não funcionam
- O contador de cliques é atualizado automaticamente via trigger no banco
