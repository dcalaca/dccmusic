# Configuração do Mercado Pago - DCC Music

## Variáveis de Ambiente

### No Vercel (Produção)

Adicione as seguintes variáveis no Vercel:

1. **Acesse:** https://vercel.com → Seu projeto → Settings → Environment Variables
2. **Adicione:**

```env
# Mercado Pago (OBRIGATÓRIO)
MERCADOPAGO_ACCESS_TOKEN=seu_access_token_aqui

# Mercado Pago Public Key (OPCIONAL - para SDK frontend)
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY=APP_USR-34a204c4-5462-47cf-b9ef-9c49956c3156

# JWT Secret (pode usar o mesmo do NextAuth)
JWT_SECRET=seu-secret-key-aqui

# URL Base (já configurado no Vercel)
NEXTAUTH_URL=https://dccmusic.vercel.app
```

3. **Marque todas para:** Production, Preview, Development
4. **Faça redeploy** após adicionar

### No Arquivo .env.local (Desenvolvimento Local)

```env
# Mercado Pago
MERCADOPAGO_ACCESS_TOKEN=seu_access_token_teste_aqui

# Public Key
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY=APP_USR-34a204c4-5462-47cf-b9ef-9c49956c3156

# JWT Secret
JWT_SECRET=seu-secret-key-aqui

# URL Base
NEXTAUTH_URL=http://localhost:3000
```

📖 **Guia Completo:** Veja `CONFIGURAR-TOKENS-VERCEL.md` para passo a passo detalhado

## Como Obter o Access Token do Mercado Pago

### Modo Teste (Sandbox):
1. Acesse: https://www.mercadopago.com.br/developers/panel
2. Faça login na sua conta
3. Vá em "Suas integrações"
4. Crie uma nova aplicação ou selecione uma existente
5. Copie o **Access Token** de teste

### Modo Produção:
1. Após testar tudo, solicite a aprovação da aplicação
2. Use o **Access Token** de produção

## Configurar Webhook

1. No painel do Mercado Pago, vá em "Webhooks"
2. Adicione a URL: `https://seu-dominio.com/api/compositores/pagamento/webhook`
3. Selecione os eventos:
   - `payment`
   - `merchant_order`

## URLs de Retorno

O sistema já está configurado com:
- **Sucesso**: `/compositores/pagamento/sucesso`
- **Falha**: `/compositores/pagamento/falha`
- **Pendente**: `/compositores/pagamento/pendente`

## Testar Pagamento

### Cartões de Teste:
- **Aprovado**: 5031 4332 1540 6351 (CVV: 123)
- **Pendente**: 5031 4332 1540 6351 (CVV: 123)
- **Rejeitado**: 5031 4332 1540 6351 (CVV: 123)

### Dados de Teste:
- Nome: APRO
- CPF: 12345678909
- Email: test@test.com

## Próximos Passos

1. ✅ Executar SQL para criar tabelas de assinaturas
2. ✅ Executar SQL para adicionar campos de autenticação em compositores
3. ⏳ Configurar variáveis de ambiente no Vercel
4. ⏳ Configurar webhook no Mercado Pago
5. ⏳ Testar fluxo completo de pagamento
