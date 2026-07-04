# 🔧 Configurar URL para Links Rastreáveis

## Problema

Se os links rastreáveis estão redirecionando para páginas de "Access Required" do Vercel, é porque estão usando URLs de preview em vez da URL de produção.

## Solução

### Opção 1: Configurar Variável de Ambiente (Recomendado)

No Vercel Dashboard, adicione a variável de ambiente:

1. Acesse: https://vercel.com/dashboard → Seu Projeto → Settings → Environment Variables
2. Adicione:

```
NEXT_PUBLIC_BASE_URL
https://www.dccmusic.online
```

**Importante:** Marque para Production, Preview e Development

3. Faça um novo deploy após adicionar

### Opção 2: Usar NEXTAUTH_URL (Já Configurado)

Se você já tem `NEXTAUTH_URL` configurado com `https://www.dccmusic.online`, o sistema já vai usar essa URL automaticamente.

## Como Funciona Agora

O sistema agora:

1. **Prioriza** `NEXT_PUBLIC_BASE_URL` ou `NEXTAUTH_URL` se estiverem configuradas
2. **Detecta automaticamente** URLs de preview do Vercel e converte para produção
3. **Usa fallback** para `https://www.dccmusic.online` se nada estiver configurado

## Verificar se Está Funcionando

1. Crie um novo link rastreável em `/admin/links/novo`
2. Verifique se o link gerado começa com `https://www.dccmusic.online/l/...`
3. Teste o link - ele deve redirecionar para a URL de destino sem pedir autenticação

## Nota

- URLs de preview do Vercel têm formato: `projeto-hash-usuario.vercel.app`
- O domínio oficial de produção é: `https://www.dccmusic.online`
- O sistema agora detecta e converte automaticamente URLs de preview para o domínio oficial
