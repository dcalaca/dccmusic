#!/bin/bash

# Script para configurar o projeto após deploy no Vercel
# Execute este script localmente após o primeiro deploy

echo "🚀 Configurando projeto DCC Music para produção..."

# Verificar se DATABASE_URL está configurado
if [ -z "$DATABASE_URL" ]; then
    echo "❌ Erro: DATABASE_URL não está configurado"
    echo "Configure a variável DATABASE_URL no Vercel antes de continuar"
    exit 1
fi

# Gerar Prisma Client
echo "📦 Gerando Prisma Client..."
npx prisma generate

# Rodar migrations
echo "🗄️  Aplicando migrations no banco de dados..."
npx prisma migrate deploy

# Seed (opcional - descomente se quiser dados iniciais)
# echo "🌱 Populando banco com dados iniciais..."
# npm run db:seed

echo "✅ Configuração concluída!"
echo ""
echo "Próximos passos:"
echo "1. Verifique se o NEXTAUTH_URL está correto no Vercel"
echo "2. Teste o login admin"
echo "3. Configure seu domínio personalizado se necessário"
