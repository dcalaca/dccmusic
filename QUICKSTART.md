# 🚀 Guia Rápido de Início

## Passo a Passo para Rodar o Projeto

### 1. Instalar Dependências
```bash
npm install
```

### 2. Configurar Banco de Dados
```bash
# Criar o banco de dados
npm run db:push

# Popular com dados de exemplo
npm run db:seed
```

### 3. Iniciar o Servidor
```bash
npm run dev
```

### 4. Acessar o Site
- **Site público:** http://localhost:3000
- **Admin:** http://localhost:3000/admin/login
  - Email: `admin@dccmusic.com`
  - Senha: `admin123`

## 📝 Próximos Passos

1. **Personalizar conteúdo:**
   - Acesse `/admin` e comece a adicionar seus próprios vídeos e músicas
   - Crie seus próprios gêneros

2. **Personalizar design:**
   - Edite `tailwind.config.ts` para mudar cores
   - Modifique componentes em `/components` para ajustar o layout

3. **Configurar produção:**
   - Veja o `README.md` para instruções de deploy
   - Configure variáveis de ambiente no seu provedor

## 🎨 Dicas

- Use Prisma Studio para visualizar o banco: `npm run db:studio`
- Os embeds do Spotify/Apple Music podem ser copiados diretamente das plataformas
- Para vídeos do YouTube, apenas cole a URL completa

## ⚠️ Importante

- Altere as credenciais padrão do admin antes de fazer deploy!
- Configure um `NEXTAUTH_SECRET` seguro em produção
- Use PostgreSQL em produção (não SQLite)
