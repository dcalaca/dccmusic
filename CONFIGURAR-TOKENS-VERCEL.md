# Como Configurar Tokens do Mercado Pago no Vercel

## Método 1: Via Painel Web do Vercel (Recomendado)

### Passo 1: Acessar o Projeto
1. Acesse: https://vercel.com
2. Faça login na sua conta
3. Clique no projeto **"dccmusic"**

### Passo 2: Ir em Settings
1. No menu superior, clique em **"Settings"**
2. No menu lateral esquerdo, clique em **"Environment Variables"**

### Passo 3: Adicionar Variáveis
Clique em **"Add New"** e adicione cada variável:

#### 1. Access Token (Obrigatório)
- **Name:** `MERCADOPAGO_ACCESS_TOKEN`
- **Value:** Cole o Access Token do Mercado Pago (clique no ícone de olho para revelar)
- **Environment:** Selecione todas as opções:
  - ✅ Production
  - ✅ Preview
  - ✅ Development
- Clique em **"Save"**

#### 2. Public Key (Opcional - para SDK frontend)
- **Name:** `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY`
- **Value:** `APP_USR-34a204c4-5462-47cf-b9ef-9c49956c3156`
- **Environment:** Todas as opções
- Clique em **"Save"**

### Passo 4: Verificar
Após adicionar, você verá as variáveis listadas. Certifique-se de que:
- ✅ Estão marcadas para **Production**
- ✅ Os valores estão corretos (sem espaços extras)

### Passo 5: Fazer Redeploy
1. Vá em **"Deployments"**
2. Clique nos **3 pontinhos** do último deployment
3. Selecione **"Redeploy"**
4. Confirme o redeploy

## Método 2: Via Vercel CLI

### Passo 1: Instalar Vercel CLI (se não tiver)
```bash
npm i -g vercel
```

### Passo 2: Fazer Login
```bash
vercel login
```

### Passo 3: Adicionar Variáveis
```bash
# Access Token
vercel env add MERCADOPAGO_ACCESS_TOKEN production

# Quando pedir o valor, cole o Access Token
# Selecione: Production, Preview, Development

# Public Key (opcional)
vercel env add NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY production
# Cole: APP_USR-34a204c4-5462-47cf-b9ef-9c49956c3156
```

### Passo 4: Verificar
```bash
vercel env ls
```

### Passo 5: Fazer Redeploy
```bash
vercel --prod
```

## Variáveis Necessárias

### Obrigatórias:
```env
MERCADOPAGO_ACCESS_TOKEN=seu_access_token_aqui
```

### Opcionais (para melhorias futuras):
```env
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY=APP_USR-34a204c4-5462-47cf-b9ef-9c49956c3156
```

## Como Obter os Tokens

### Access Token:
1. No painel do Mercado Pago, vá em "Suas integrações"
2. Selecione sua aplicação
3. Na seção "Credenciais de produção" ou "Credenciais de teste"
4. Clique no ícone de **olho** ao lado do Access Token
5. Copie o token completo

### Public Key:
- Já está visível: `APP_USR-34a204c4-5462-47cf-b9ef-9c49956c3156`
- Copie diretamente

## Importante

### ⚠️ Access Token vs Public Key

- **Access Token**: Usado no **backend** (servidor)
  - Criar preferências de pagamento
  - Processar webhooks
  - Consultar pagamentos
  - **NUNCA** exponha no frontend!

- **Public Key**: Usado no **frontend** (cliente)
  - Inicializar SDK do Mercado Pago
  - Pode ser exposta publicamente
  - Prefixo `NEXT_PUBLIC_` para Next.js

### 🔒 Segurança

- ✅ Use **Access Token de TESTE** para desenvolvimento
- ✅ Use **Access Token de PRODUÇÃO** apenas em produção
- ✅ Nunca commite tokens no Git
- ✅ Use variáveis de ambiente sempre

## Verificando se Funcionou

### 1. Verificar no Vercel
- Vá em Settings → Environment Variables
- Confirme que as variáveis estão lá

### 2. Verificar nos Logs
```bash
vercel logs https://dccmusic.vercel.app
```

Procure por erros relacionados a "MERCADOPAGO_ACCESS_TOKEN"

### 3. Testar Criando Preferência
1. Acesse `/compositores/planos`
2. Clique em "Assinar Agora"
3. Se funcionar, o token está configurado ✅
4. Se der erro, verifique os logs

## Troubleshooting

### Erro: "Invalid access token"
- Verifique se copiou o token completo (sem espaços)
- Confirme que está usando o token correto (teste vs produção)
- Verifique se fez redeploy após adicionar

### Erro: "Environment variable not found"
- Confirme que adicionou para **Production**
- Faça um redeploy após adicionar
- Verifique o nome exato: `MERCADOPAGO_ACCESS_TOKEN`

### Variável não aparece
- Certifique-se de salvar após adicionar
- Verifique se está no projeto correto
- Tente adicionar novamente

## Checklist Final

- [ ] Access Token adicionado no Vercel
- [ ] Variável marcada para Production
- [ ] Redeploy feito
- [ ] Testado criando uma preferência
- [ ] Webhook configurado no Mercado Pago
- [ ] Tudo funcionando ✅
