# DCC Music i18n

Estrutura central de internacionalização criada para permitir uma migração gradual e segura.

## Objetivo

Os textos atuais continuam funcionando exatamente como estão. Esta pasta ainda não altera nenhuma página, rota, e-mail ou fluxo do site.

Conforme cada área for migrada, o componente deixa de manter frases soltas e passa a consumir uma chave central, por exemplo:

```ts
t('studio.actions.createSong')
```

Cada idioma mantém o próprio texto em `i18n/messages/<locale>.json`.

## Idiomas preparados

- pt-BR — Brasil
- pt-PT — Portugal
- en-US — Estados Unidos
- en-GB — Reino Unido
- es-ES — Espanha
- es-MX — México
- es-CO — Colômbia
- es-PY — Paraguai

## Regras para a migração

1. Migrar uma área de cada vez.
2. Nunca apagar o comportamento atual antes de validar a nova tradução.
3. Preferir frases naturais no país, e não tradução palavra por palavra.
4. Usar variáveis para dados dinâmicos, sem concatenar pedaços de frases.
5. Manter `pt-BR` como fallback seguro.
6. Não colocar textos de interface no Supabase; conteúdo editorial/dinâmico pode continuar vindo do banco quando fizer sentido.
7. Não alterar idioma, moeda, país ou regras comerciais nesta camada.

## Estrutura inicial de chaves

Os arquivos começam apenas com textos comuns. Novos namespaces devem acompanhar a área migrada, por exemplo:

- `auth.*`
- `menu.*`
- `studio.*`
- `plans.*`
- `emails.*`

A estrutura foi propositalmente criada sem dependência externa para não alterar o runtime atual. Se no futuro for necessário adotar `next-intl` ou outra biblioteca, os arquivos de mensagens e os locales podem ser reaproveitados.
