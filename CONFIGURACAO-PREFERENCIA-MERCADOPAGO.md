# Configuração da Preferência de Pagamento - Mercado Pago

## O que é uma Preferência de Pagamento?

Uma preferência de pagamento é um objeto que contém todas as informações necessárias para processar um pagamento no Mercado Pago. Ela define:
- O que está sendo vendido (itens)
- Quem está pagando (pagador)
- Para onde redirecionar após o pagamento (URLs de retorno)
- Como receber notificações (webhook)
- Métodos de pagamento aceitos
- Parcelamento disponível

## Configuração Atual no Sistema

### Campos Configurados:

#### 1. **Items (Itens)**
```javascript
items: [{
  id: plan.id,                    // ID único do plano
  title: plan.name,                // Nome do plano
  description: plan.description,   // Descrição detalhada
  quantity: 1,                    // Quantidade (sempre 1 para assinatura)
  unit_price: plan.price,         // Preço unitário (R$ 100.00)
  currency_id: 'BRL',             // Moeda brasileira
}]
```

#### 2. **Payer (Pagador)**
```javascript
payer: {
  email: composerEmail,            // Email do compositor
}
```

#### 3. **Back URLs (URLs de Retorno)**
```javascript
back_urls: {
  success: '/compositores/pagamento/sucesso',  // Pagamento aprovado
  failure: '/compositores/pagamento/falha',    // Pagamento rejeitado
  pending: '/compositores/pagamento/pendente', // Pagamento pendente
}
```

#### 4. **Auto Return**
```javascript
auto_return: 'approved'  // Redireciona automaticamente quando aprovado
```

#### 5. **External Reference**
```javascript
external_reference: subscription.id  // ID da assinatura no nosso banco
```

#### 6. **Notification URL (Webhook)**
```javascript
notification_url: 'https://dccmusic.vercel.app/api/compositores/pagamento/webhook'
```

#### 7. **Statement Descriptor**
```javascript
statement_descriptor: 'DCC Music'  // Aparece na fatura do cartão
```

#### 8. **Metadata**
```javascript
metadata: {
  composer_id: composer.id,
  composer_name: composer.name,
  plan_id: plan.id,
  plan_name: plan.name,
  subscription_id: subscription.id,
}
```

#### 9. **Payment Methods (Métodos de Pagamento)**
```javascript
payment_methods: {
  excluded_payment_types: [],      // Aceita todos os tipos
  excluded_payment_methods: [],   // Aceita todos os métodos
  installments: 12,                // Permite parcelamento até 12x
}
```

#### 10. **Binary Mode**
```javascript
binary_mode: false  // Aceita pagamentos pendentes também
```

#### 11. **Expiration (Expiração)**
```javascript
expires: true,
expiration_date_from: new Date().toISOString(),
expiration_date_to: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 horas
```

## Fluxo Completo

1. **Compositor escolhe plano** → `/compositores/planos`
2. **Clica em "Assinar Agora"** → `/compositores/checkout`
3. **Sistema cria assinatura pendente** no banco de dados
4. **Sistema cria preferência no Mercado Pago** com todas as configurações acima
5. **Redireciona para Mercado Pago** usando `init_point` ou `sandbox_init_point`
6. **Compositor paga** no Mercado Pago
7. **Mercado Pago envia notificação** para nosso webhook
8. **Sistema atualiza assinatura** para "active"
9. **Compositor é redirecionado** para página de sucesso
10. **Status premium é ativado automaticamente** via trigger do banco

## Personalizações Possíveis

### Excluir Métodos de Pagamento Específicos

Se quiser excluir algum método de pagamento:

```javascript
payment_methods: {
  excluded_payment_types: [
    { id: 'ticket' }  // Exclui boleto
  ],
  excluded_payment_methods: [
    { id: 'pec' }     // Exclui PEC
  ],
}
```

### Limitar Parcelamento

```javascript
payment_methods: {
  installments: 1,  // Apenas à vista
}
```

### Aceitar Apenas Pagamentos Aprovados

```javascript
binary_mode: true  // Rejeita pagamentos pendentes
```

## Testando

### Cartões de Teste:

- **Aprovado**: 5031 4332 1540 6351 (CVV: 123)
- **Pendente**: 5031 4332 1540 6351 (CVV: 123)
- **Rejeitado**: 5031 4332 1540 6351 (CVV: 123)

### Dados de Teste:
- Nome: APRO
- CPF: 12345678909
- Email: test@test.com

## Troubleshooting

### Erro: "Invalid access token"
- Verifique se `MERCADOPAGO_ACCESS_TOKEN` está configurado corretamente no Vercel
- Use o token de **teste** para desenvolvimento e **produção** para produção

### Erro: "Invalid notification_url"
- Certifique-se de que a URL do webhook é acessível publicamente
- Use HTTPS em produção
- A URL deve retornar status 200 quando o Mercado Pago fizer GET

### Preferência não expira
- Verifique se `expires: true` está configurado
- As datas devem estar no formato ISO 8601
