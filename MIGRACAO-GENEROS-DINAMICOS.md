# 🎵 Migração para Gêneros Dinâmicos

## O que mudou?

Os gêneros agora são **extraídos dinamicamente** das músicas e vídeos cadastrados, em vez de usar uma tabela separada. Isso significa:

- ✅ Você digita o gênero diretamente ao cadastrar música/vídeo
- ✅ Os filtros mostram apenas gêneros que realmente existem no site
- ✅ Não precisa mais gerenciar uma lista de gêneros separadamente

## Passos para migrar

### 1. Execute o SQL de migração

No **Supabase SQL Editor**, execute o arquivo:
```
SQL-MIGRAR-GENEROS-DINAMICOS.sql
```

Este script:
- Adiciona coluna `genre` (texto) nas tabelas `dccmusic_videos` e `dccmusic_musics`
- Migra dados existentes (se houver)
- Remove foreign keys antigas
- Cria índices para melhor performance

### 2. Atualize os dados existentes (se necessário)

Se você já tinha vídeos/músicas cadastrados com `genre_id`, eles serão migrados automaticamente pelo SQL. Se não tiver dados ainda, pode pular esta etapa.

### 3. Teste o sistema

1. Acesse `/admin/videos/novo` ou `/admin/musicas/nova`
2. Você verá um campo de texto para "Gênero" (em vez de um select)
3. Digite o gênero diretamente (ex: "Pop", "Rock", "EDM")
4. Ao salvar, o gênero aparecerá automaticamente nos filtros

## Como funciona agora?

### Cadastro de Conteúdo
- **Vídeos**: Campo "Gênero" é um input de texto livre
- **Músicas**: Campo "Gênero" é um input de texto livre
- Você pode digitar qualquer gênero (ex: "Pop", "Rock", "Hip Hop", "R&B")

### Filtros
- Os filtros mostram apenas gêneros que existem nas músicas/vídeos cadastrados
- Gêneros são extraídos automaticamente e ordenados alfabeticamente
- Não há mais necessidade de criar gêneros manualmente

### Página Admin de Gêneros
- A página `/admin/generos` ainda existe, mas agora mostra apenas gêneros extraídos dinamicamente
- Você não pode mais criar/editar gêneros manualmente (eles são criados automaticamente ao cadastrar conteúdo)

## Observações

- **Case-sensitive**: "Pop" e "pop" serão tratados como gêneros diferentes
- **Espaços**: "Hip Hop" e "HipHop" serão tratados como gêneros diferentes
- **Recomendação**: Use sempre a mesma grafia para o mesmo gênero (ex: sempre "Hip Hop" com espaço)

## Próximos passos

1. Execute o SQL de migração
2. Teste cadastrando uma música/vídeo com gênero
3. Verifique se o gênero aparece nos filtros automaticamente
