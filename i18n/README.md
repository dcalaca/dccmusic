# DCC Music i18n

Estrutura central de internacionalização para migração gradual e segura.

## Estado atual

`i18next` e `react-i18next` já fazem parte das dependências do projeto, mas ainda não foram ligados globalmente à aplicação. Isso é intencional: nenhuma página, rota, e-mail ou fluxo atual foi alterado.

A base está pronta para cada área ser migrada aos poucos com chamadas como:

```ts
t('studio.actions.createSong')
```

Os textos ficam centralizados em `i18n/messages/<locale>.json`.

## Idiomas preparados

- pt-BR — Brasil
- pt-PT — Portugal
- en-US — Estados Unidos
- en-GB — Reino Unido
- es-ES — Espanha
- es-MX — México
- es-CO — Colômbia
- es-PY — Paraguai

## Integração i18next

O arquivo `i18n/i18next.ts` concentra os recursos, o fallback e a criação de uma instância i18next.

Exemplo futuro:

```ts
const i18n = await createDccI18n('en-GB')
i18n.t('common.actions.continue')
```

Quando começarmos a migrar componentes React, poderemos usar `react-i18next` e `useTranslation()` sem reorganizar novamente os arquivos.

## Por que não usamos `src/config/locales/en/translation.json`?

Essa estrutura também é válida. A DCC já usa a aplicação a partir da raiz do repositório, então mantemos `i18n/messages` na raiz para evitar criar um segundo padrão de pastas apenas para traduções.

Além disso, usamos locales regionais (`en-US`, `en-GB`, `es-ES`, `es-MX` etc.) porque a DCC já trabalha com países, moedas e linguagem regional.

## Regras para a migração

1. Migrar uma área de cada vez.
2. Não apagar o comportamento antigo antes de validar a nova tradução.
3. Preferir frases naturais no país, não tradução palavra por palavra.
4. Usar variáveis para dados dinâmicos, sem concatenar pedaços de frases.
5. Manter `pt-BR` como fallback seguro.
6. Não colocar textos normais de interface no Supabase.
7. Não misturar esta camada com moeda, país ou regras comerciais.
8. Evitar um singleton global compartilhado no servidor; criar instâncias por contexto quando necessário.

## Estrutura inicial de chaves

- `auth.*`
- `menu.*`
- `studio.*`
- `plans.*`
- `emails.*`
