# Configuração Frontend - Mercado Pago Checkout Pro

## Integração Web

O sistema está configurado para usar o **Checkout Pro** do Mercado Pago de duas formas:

### 1. Redirecionamento Direto (Atual - Funcionando)

O método mais simples e que já está funcionando:

```javascript
// Quando a preferência é criada, redirecionamos diretamente
window.location.href = initPoint
```

**Vantagens:**
- ✅ Simples e direto
- ✅ Funciona imediatamente
- ✅ Não requer configuração adicional
- ✅ Compatível com todos os navegadores

**Como funciona:**
1. Compositor clica em "Assinar Agora"
2. Sistema cria preferência no backend
3. Recebe `init_point` ou `sandbox_init_point`
4. Redireciona automaticamente para o Mercado Pago
5. Compositor paga no site do Mercado Pago
6. Retorna para nossa página de sucesso/falha

### 2. SDK JavaScript (Opcional - Melhor Experiência)

Para uma experiência mais integrada, podemos usar o SDK JavaScript do Mercado Pago:

#### Instalação do SDK

O SDK é carregado automaticamente via script tag:

```html
<script src="https://sdk.mercadopago.com/js/v2"></script>
```

#### Uso do SDK

```javascript
const mp = new MercadoPago('PUBLIC_KEY', {
  locale: 'pt-BR'
})

mp.checkout({
  preference: {
    id: preferenceId
  },
  render: {
    container: '.mercadopago-checkout-container',
    label: 'Pagar',
  }
})
```

**Vantagens:**
- ✅ Experiência mais integrada
- ✅ Pode abrir em modal/iframe
- ✅ Melhor UX

**Desvantagens:**
- ⚠️ Requer PUBLIC_KEY do Mercado Pago
- ⚠️ Mais complexo de configurar

## Configuração Atual

### Variáveis Necessárias

**Backend (já configurado):**
```env
MERCADOPAGO_ACCESS_TOKEN=seu_access_token
```

**Frontend (opcional para SDK):**
```env
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY=seu_public_key
```

### Como Obter a Public Key

1. Acesse: https://www.mercadopago.com.br/developers/panel
2. Vá em "Suas integrações"
3. Selecione sua aplicação
4. Copie a **Public Key** (não a Access Token)

## Fluxo Atual Implementado

```
1. Compositor → /compositores/planos
2. Clica "Assinar Agora" → /compositores/checkout?plan=plano-anual
3. Sistema cria preferência → API /api/compositores/pagamento/preferencia
4. Recebe init_point → Redireciona para Mercado Pago
5. Compositor paga → Mercado Pago processa
6. Webhook recebe notificação → /api/compositores/pagamento/webhook
7. Sistema atualiza assinatura → Status vira "active"
8. Compositor retorna → /compositores/pagamento/sucesso
```

## Melhorias Implementadas

### ✅ Checkout Page Melhorada

- Carregamento automático do SDK (se disponível)
- Fallback para redirecionamento direto
- Mensagens de loading mais claras
- Botão de redirecionamento manual como backup
- Indicador de segurança

### ✅ Tratamento de Erros

- Erros são exibidos claramente
- Opção de voltar para planos
- Logs de erro no console para debug

### ✅ Responsividade

- Funciona em desktop e mobile
- Layout adaptativo
- Botões touch-friendly

## Testando a Integração

### 1. Teste Básico (Redirecionamento)

1. Acesse `/compositores/planos`
2. Clique em "Assinar Agora"
3. Deve redirecionar para Mercado Pago
4. Use cartão de teste: `5031 4332 1540 6351`
5. Complete o pagamento
6. Deve retornar para página de sucesso

### 2. Teste com SDK (Opcional)

1. Adicione `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` no Vercel
2. Acesse `/compositores/checkout`
3. SDK deve carregar automaticamente
4. Botão do Mercado Pago deve aparecer
5. Clique no botão para abrir checkout

## Troubleshooting

### Erro: "SDK não carregado"
- Verifique se a URL do SDK está acessível
- Pode ser bloqueado por adblockers
- Sistema usa fallback automático

### Erro: "Preferência não encontrada"
- Verifique se `preferenceId` está correto
- Confirme que a preferência foi criada no backend
- Verifique logs do servidor

### Redirecionamento não funciona
- Verifique se `initPoint` está sendo retornado
- Confirme que a URL está correta
- Teste em modo anônimo (sem extensões)

## Próximos Passos (Opcional)

### Melhorias Futuras:

1. **Modal de Checkout**
   - Abrir checkout em modal ao invés de redirecionar
   - Melhor experiência do usuário

2. **Status em Tempo Real**
   - Polling para verificar status do pagamento
   - Atualização automática sem recarregar

3. **Retry Automático**
   - Tentar novamente se falhar
   - Melhor tratamento de erros de rede

4. **Analytics**
   - Rastrear conversões
   - Métricas de checkout

## Documentação Oficial

- [Checkout Pro - Web Integration](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/web-integration)
- [SDK JavaScript](https://github.com/mercadopago/sdk-js)
- [Exemplos de Código](https://github.com/mercadopago/checkout-payment-sample)
