# 🔄 Atualizar Schema Cache do Supabase

Após criar ou renomear tabelas no Supabase, você precisa atualizar o schema cache para que o Supabase reconheça as novas tabelas.

## Método 1: Via Dashboard (Recomendado)

1. Acesse o **Supabase Dashboard**
2. Vá em **Settings** → **API**
3. Role até a seção **Schema Cache**
4. Clique em **Clear Cache** ou **Refresh Schema**
5. Aguarde alguns segundos

## Método 2: Via SQL

Execute este SQL no **SQL Editor**:

```sql
-- Forçar atualização do schema cache
NOTIFY pgrst, 'reload schema';
```

## Método 3: Reiniciar o Projeto (se disponível)

Se você tiver acesso ao projeto, pode reiniciar o PostgREST que gerencia o schema cache.

## Depois de atualizar

Execute novamente o seed:

```bash
npm run db:seed
```

## Verificar se funcionou

Após atualizar o cache, você pode verificar se as tabelas estão acessíveis:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'dccmusic_%';
```

Isso deve retornar:
- dccmusic_users
- dccmusic_genres
- dccmusic_videos
- dccmusic_musics
