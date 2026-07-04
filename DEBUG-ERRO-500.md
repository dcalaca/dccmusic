# Como Debugar o Erro 500

## Passo 1: Verificar Logs do Vercel

### Via CLI:
```bash
vercel logs https://dccmusic.vercel.app --follow
```

### Via Web:
1. Acesse: https://vercel.com
2. Vá no projeto "dccmusic"
3. Clique em "Deployments"
4. Clique no último deployment
5. Vá em "Functions" → "Logs"
6. Procure por erros com `[PREFERENCIA]`

## Possíveis Causas do Erro 500

### 1. Token do Mercado Pago não configurado
**Sintoma:** Log mostra "MERCADOPAGO_ACCESS_TOKEN não configurado"

**Solução:**
- Verifique se `MERCADOPAGO_ACCESS_TOKEN` está no Vercel
- Confirme que está marcado para **Production**
- Faça redeploy após adicionar

### 2. Token inválido
**Sintoma:** Log mostra "Invalid access_token" ou erro 401

**Solução:**
- Verifique se copiou o token completo (sem espaços)
- Confirme que está usando token de **produção** (não teste)
- Gere um novo token no painel do Mercado Pago

### 3. Erro ao criar assinatura no banco
**Sintoma:** Log mostra "Erro ao criar assinatura"

**Solução:**
- Verifique se a tabela `dccmusic_subscriptions` existe
- Confirme que o compositor existe no banco
- Verifique se o plano existe e está ativo

### 4. Compositor não encontrado
**Sintoma:** Log mostra "Compositor não encontrado"

**Solução:**
- Verifique se o compositor está logado
- Confirme que `composer_data` está no localStorage
- Verifique se o ID/slug do compositor está correto

### 5. Plano não encontrado
**Sintoma:** Log mostra "Plano não encontrado"

**Solução:**
- Verifique se existe um plano com slug `plano-anual-compositor`
- Confirme que o plano está marcado como `is_active = true`
- Execute o SQL de criação de planos se necessário

## Verificar Dados no Banco

### Verificar se plano existe:
```sql
SELECT * FROM dccmusic_plans WHERE slug = 'plano-anual-compositor';
```

### Verificar compositor:
```sql
SELECT id, name, slug, email FROM dccmusic_composers LIMIT 10;
```

### Verificar tabela de assinaturas:
```sql
SELECT * FROM dccmusic_subscriptions ORDER BY created_at DESC LIMIT 5;
```

## Teste Manual da API

Você pode testar a API diretamente:

```bash
curl -X POST https://dccmusic.vercel.app/api/compositores/pagamento/preferencia \
  -H "Content-Type: application/json" \
  -d '{
    "composerId": "id-do-compositor-aqui",
    "planId": "plano-anual-compositor"
  }'
```

## Próximos Passos

1. **Verifique os logs** usando um dos métodos acima
2. **Identifique o erro específico** nos logs
3. **Me envie o erro** que aparecer nos logs
4. **Vou corrigir** baseado no erro específico

## Logs Melhorados

Agora o código tem logs detalhados que mostram:
- ✅ Se o token está configurado
- ✅ Dados recebidos na requisição
- ✅ Erros específicos em cada etapa
- ✅ Detalhes do erro do Mercado Pago

Isso vai ajudar a identificar exatamente onde está o problema!
