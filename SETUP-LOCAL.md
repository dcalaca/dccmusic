# 🖥️ Setup Local - DCC Music

## Passo a Passo Rápido

### 1. Verificar se as dependências estão instaladas
```bash
npm install
```

### 2. Verificar arquivo .env
O arquivo `.env` já está configurado com suas credenciais do Supabase. Verifique se está correto:

```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=callcenter-secret-key-change-in-production-813663756
ADMIN_EMAIL=dcalaca@gmail.com
ADMIN_PASSWORD=5778

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://hsduizbqsrfhhulcrmye.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_0k6BjCY9Ze0Myj1vSR01BA_WhUjarA_
SUPABASE_SERVICE_ROLE_KEY=sb_publishable_0k6BjCY9Ze0Myj1vSR01BA_WhUjarA_

# Mercado Pago (para testes)
MERCADOPAGO_ACCESS_TOKEN=APP_USR-8561941754979098-112613-eb9e048d09e158c3a5121f725da419b2-94107750
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY=APP_USR-b46edff5-b5b0-42e9-a562-3dcc6a4b9c97
```

### 3. Rodar o projeto localmente
```bash
npm run dev
```

### 4. Acessar o site
- **Site público:** http://localhost:3000
- **Admin:** http://localhost:3000/admin/login
  - Email: `dcalaca@gmail.com`
  - Senha: `5778`

## ✅ O que já está configurado

- ✅ Banco de dados Supabase (conectado remotamente)
- ✅ Autenticação admin (via tabela dccmusic_users)
- ✅ Sistema de compositores e assinaturas
- ✅ Integração Mercado Pago

## 🔧 Comandos Úteis

```bash
# Rodar em desenvolvimento
npm run dev

# Build para produção (testar localmente)
npm run build
npm run start

# Verificar erros de lint
npm run lint
```

## 🐛 Troubleshooting

### Erro de conexão com Supabase
- Verifique se sua rede permite acesso ao Supabase
- Se estiver bloqueado, você pode usar um VPN ou hotspot do celular

### Erro de autenticação admin
- Verifique se executou o SQL `SQL-CRIAR-ADMIN-COMPLETO.sql` no Supabase
- Confirme que o usuário existe na tabela `dccmusic_users`

### Porta 3000 já em uso
```bash
# Use outra porta
PORT=3001 npm run dev
```

## 📝 Próximos Passos Após Testar Localmente

1. Testar todas as funcionalidades
2. Fazer ajustes necessários
3. Quando estiver tudo OK, fazer deploy:
   ```bash
   vercel --prod
   ```
