# Configuração de Webhooks - Mercado Pago

## O que são Webhooks?

Webhooks são notificações que o Mercado Pago envia para sua aplicação quando eventos importantes acontecem, como:
- ✅ Pagamento aprovado
- ⏳ Pagamento pendente
- ❌ Pagamento rejeitado
- 🔄 Atualização de status de pagamento

## Endpoint Configurado

**URL do Webhook:**
```
https://dccmusic.vercel.app/api/compositores/pagamento/webhook
```

## Como Configurar no Painel do Mercado Pago

### Passo 1: Acessar o Painel
1. Acesse: https://www.mercadopago.com.br/developers/panel
2. Faça login na sua conta
3. Vá em **"Suas integrações"**
4. Selecione sua aplicação

### Passo 2: Configurar Webhook
1. No menu lateral, clique em **"Webhooks"** ou **"Notificações"**
2. Clique em **"Adicionar URL"** ou **"Configurar Webhook"**
3. Cole a URL: `https://dccmusic.vercel.app/api/compositores/pagamento/webhook`
4. Selecione os **eventos** que deseja receber:
   - ✅ `payment` (Pagamentos)
   - ✅ `merchant_order` (Pedidos do vendedor)
   - ✅ `subscription` (Assinaturas - se aplicável)

### Passo 3: Salvar Configuração
1. Clique em **"Salvar"** ou **"Confirmar"**
2. O Mercado Pago fará uma requisição GET para verificar se a URL está acessível
3. Se retornar status 200, o webhook está configurado ✅

## Como o Webhook Funciona

### Fluxo de Notificação

```
1. Compositor paga no Mercado Pago
   ↓
2. Mercado Pago processa pagamento
   ↓
3. Mercado Pago envia POST para nosso webhook
   POST /api/compositores/pagamento/webhook
   Body: { type: 'payment', data: { id: '...', status: 'approved', ... } }
   ↓
4. Nosso sistema processa a notificação
   - Busca assinatura pelo external_reference
   - Atualiza status da assinatura
   - Cria registro de pagamento
   - Atualiza status premium do compositor (via trigger)
   ↓
5. Retorna 200 OK para Mercado Pago
```

## Código do Webhook

### Estrutura da Notificação

O Mercado Pago envia notificações no formato:

```json
{
  "type": "payment",
  "data": {
    "id": "123456789",
    "status": "approved",
    "status_detail": "accredited",
    "transaction_amount": 100.00,
    "currency_id": "BRL",
    "payment_method_id": "visa",
    "external_reference": "subscription-uuid",
    "date_created": "2024-01-01T00:00:00.000Z",
    "date_approved": "2024-01-01T00:00:00.000Z"
  }
}
```

### Processamento

O webhook atual processa:

1. **Verifica o tipo de notificação** (`payment`)
2. **Extrai dados do pagamento**:
   - `id` - ID do pagamento
   - `status` - Status (approved, pending, rejected)
   - `external_reference` - ID da assinatura
   - `transaction_amount` - Valor pago
3. **Busca a assinatura** pelo `external_reference`
4. **Cria registro de pagamento** na tabela `dccmusic_payments`
5. **Atualiza status da assinatura**:
   - `approved` → `active`
   - `pending` → `pending`
   - `rejected` → `cancelled`
6. **Trigger automático** atualiza `is_premium` do compositor

## Testando o Webhook

### 1. Teste Manual (usando cURL)

```bash
curl -X POST https://dccmusic.vercel.app/api/compositores/pagamento/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "type": "payment",
    "data": {
      "id": "123456789",
      "status": "approved",
      "transaction_amount": 100.00,
      "currency_id": "BRL",
      "external_reference": "seu-subscription-id-aqui",
      "payment_method_id": "visa"
    }
  }'
```

### 2. Teste com Pagamento Real

1. Faça um pagamento de teste usando cartão de teste
2. O Mercado Pago enviará automaticamente a notificação
3. Verifique os logs do Vercel para ver se recebeu
4. Confirme que a assinatura foi atualizada no banco

### 3. Verificar Logs

No Vercel:
```bash
vercel logs https://dccmusic.vercel.app
```

Ou no painel do Vercel:
1. Vá em seu projeto
2. Clique em "Deployments"
3. Selecione o deployment
4. Vá em "Functions" → "Logs"

## Segurança do Webhook

### Validação (Recomendado)

Para produção, você deve validar que a notificação realmente veio do Mercado Pago:

```typescript
// Verificar assinatura (se configurado)
const xSignature = request.headers.get('x-signature')
const xRequestId = request.headers.get('x-request-id')

// Buscar pagamento no Mercado Pago para validar
const payment = await mercadoPagoClient.payment.get({ id: data.id })
```

### Headers Importantes

O Mercado Pago envia headers úteis:

- `x-signature` - Assinatura da notificação (se configurado)
- `x-request-id` - ID único da requisição
- `x-sent-timestamp` - Timestamp do envio

## Troubleshooting

### Webhook não está recebendo notificações

1. **Verifique se a URL está correta**
   - Deve ser HTTPS em produção
   - Deve retornar 200 OK

2. **Verifique se o webhook está ativo no painel**
   - Vá em "Webhooks" no painel do Mercado Pago
   - Confirme que está "Ativo"

3. **Verifique os logs**
   - Veja se há erros no Vercel
   - Confirme que a rota está acessível

4. **Teste manualmente**
   - Use cURL ou Postman para testar
   - Verifique se retorna 200

### Webhook recebe mas não processa

1. **Verifique o formato da notificação**
   - Confirme que `external_reference` está correto
   - Verifique se `type` é `payment`

2. **Verifique os logs do servidor**
   - Procure por erros no console
   - Confirme que a assinatura existe

3. **Verifique o banco de dados**
   - Confirme que a assinatura foi criada
   - Verifique se o `external_reference` está correto

### Erro 500 no Webhook

1. **Verifique os logs do Vercel**
   - Veja qual erro específico está ocorrendo
   - Pode ser problema de conexão com banco

2. **Verifique variáveis de ambiente**
   - Confirme que `MERCADOPAGO_ACCESS_TOKEN` está configurado
   - Verifique conexão com Supabase

## Melhorias Futuras

### 1. Validação de Assinatura
- Validar que a notificação veio do Mercado Pago
- Usar `x-signature` para verificação

### 2. Retry Logic
- Implementar retry em caso de falha
- Log de tentativas

### 3. Idempotência
- Evitar processar a mesma notificação duas vezes
- Usar `x-request-id` para rastreamento

### 4. Notificações por Email
- Enviar email quando pagamento for aprovado
- Notificar compositor sobre status

## Documentação Oficial

- [Webhooks - Mercado Pago](https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks)
- [Notificações IPN](https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/ipn)
- [Validação de Webhooks](https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks#bookmark_validação_de_webhooks)

## Checklist de Configuração

- [ ] Acessar painel do Mercado Pago
- [ ] Ir em "Webhooks" ou "Notificações"
- [ ] Adicionar URL: `https://dccmusic.vercel.app/api/compositores/pagamento/webhook`
- [ ] Selecionar eventos: `payment`, `merchant_order`
- [ ] Salvar configuração
- [ ] Verificar que retornou 200 OK
- [ ] Testar com pagamento de teste
- [ ] Verificar logs do Vercel
- [ ] Confirmar que assinatura foi atualizada
