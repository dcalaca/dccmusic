# Sistema de Assinaturas para Compositors - DCC Music

## Visão Geral

Sistema onde compositores pagam R$ 100/ano para ter acesso completo ao sistema, podendo cadastrar suas músicas/vídeos e ter uma página exclusiva (currículo online).

## Arquitetura

### 1. Banco de Dados

**Tabelas criadas:**
- `dccmusic_plans` - Planos de assinatura
- `dccmusic_subscriptions` - Assinaturas dos compositores
- `dccmusic_payments` - Histórico de pagamentos

**Campos adicionados em `dccmusic_composers`:**
- `has_active_subscription` - Se tem assinatura ativa
- `subscription_expires_at` - Data de expiração
- `is_premium` - Se é compositor premium

### 2. Fluxo do Sistema

#### Para Compositors:
1. **Cadastro/Login** → `/compositores/cadastro` ou `/compositores/login`
2. **Escolher Plano** → `/compositores/planos`
3. **Pagamento** → Integração com gateway (Stripe/PagSeguro/Mercado Pago)
4. **Área Administrativa** → `/compositores/admin`
   - Cadastrar músicas
   - Cadastrar vídeos
   - Ver estatísticas
   - Gerenciar assinatura
5. **Página Pública** → `/compositores/[slug]` (currículo online)

#### Para Usuários do Site Principal:
1. **Buscar Compositor** → Barra de busca no header
2. **Ver Compositor** → `/compositores/[slug]`
3. **Ver Músicas/Vídeos** → Navegar pelo conteúdo do compositor

### 3. Páginas a Criar

#### Públicas:
- `/compositores` - Lista de compositores premium
- `/compositores/[slug]` - Página do compositor (já existe, melhorar)
- `/compositores/buscar` - Busca de compositores

#### Para Compositors:
- `/compositores/cadastro` - Cadastro de novo compositor
- `/compositores/login` - Login
- `/compositores/planos` - Escolher plano
- `/compositores/pagamento` - Processar pagamento
- `/compositores/admin` - Dashboard do compositor
- `/compositores/admin/musicas` - Gerenciar músicas
- `/compositores/admin/videos` - Gerenciar vídeos
- `/compositores/admin/assinatura` - Gerenciar assinatura

### 4. Integração de Pagamento

**Opções:**
- **Stripe** (recomendado para internacional)
- **PagSeguro** (Brasil)
- **Mercado Pago** (Brasil)

**Fluxo:**
1. Compositor escolhe plano
2. Redireciona para gateway de pagamento
3. Gateway retorna webhook com status
4. Sistema atualiza assinatura automaticamente

### 5. Segurança

- Autenticação separada para compositores (não usar mesma do admin)
- RLS no Supabase para proteger dados
- Verificação de assinatura ativa antes de permitir cadastro de conteúdo
- Validação de propriedade (compositor só edita suas próprias músicas/vídeos)

### 6. Funcionalidades Premium

- Compositor premium pode:
  - Cadastrar músicas ilimitadas
  - Cadastrar vídeos ilimitados
  - Ter página exclusiva personalizada
  - Ver estatísticas de visualizações
  - Ter badge "Premium" na página

- Compositor não premium:
  - Pode ver sua página (se já existir conteúdo)
  - Não pode cadastrar novo conteúdo
  - Vê CTA para assinar

## Próximos Passos

1. ✅ Criar estrutura de banco de dados
2. ✅ Atualizar interfaces TypeScript
3. ⏳ Criar página de busca de compositores
4. ⏳ Criar área de login/cadastro para compositores
5. ⏳ Criar área administrativa para compositores
6. ⏳ Integrar gateway de pagamento
7. ⏳ Melhorar página pública do compositor
