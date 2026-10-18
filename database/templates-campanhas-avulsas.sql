-- Modelos reutilizáveis para campanhas de prospecção avulsas (acesso somente pelo servidor admin).
CREATE TABLE IF NOT EXISTS public.templates_campanhas_avulsas (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 slug text NOT NULL UNIQUE,
 title text NOT NULL,
 campaign_name text NOT NULL,
 subject text NOT NULL CHECK (char_length(subject) <= 200),
 body text NOT NULL CHECK (char_length(body) <= 30000),
 description text NOT NULL DEFAULT '',
 sort_order integer NOT NULL DEFAULT 0,
 active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.templates_campanhas_avulsas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.templates_campanhas_avulsas FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.templates_campanhas_avulsas TO service_role;
INSERT INTO public.templates_campanhas_avulsas
 (slug,title,campaign_name,subject,body,description,sort_order,active)
VALUES
('primeira-musica-gratis', 'Primeira música grátis', 'Prospecção — Primeira música grátis', 'Sua primeira música com IA é grátis na DCC Music', 'Olá, {nome}!

Você já imaginou transformar uma ideia sua em uma música de verdade?

Na DCC Music, você descreve o que quer ou escreve sua própria letra. A inteligência artificial ajuda a transformar isso em música, mesmo que você nunca tenha composto antes.

E para experimentar, sua primeira música é grátis!

Que tal criar a sua hoje?

Um abraço,
Equipe DCC Music', 'Oferta direta para quem ainda não conhece a plataforma.', 1, true),
('ideia-do-papel', 'Tire a ideia do papel', 'Prospecção — Tire a ideia do papel', 'Tem uma ideia de música? Tire ela do papel', 'Olá, {nome}!

Às vezes, uma música começa com uma frase, uma lembrança ou uma ideia que não sai da cabeça.

Na DCC Music, você pode transformar essa ideia em música usando inteligência artificial. Você escolhe o estilo e conta o que quer expressar.

Não precisa saber tocar instrumentos nem ter experiência musical.

Experimente: sua primeira música é grátis.

Sua próxima música pode começar com uma única frase.

Equipe DCC Music', 'Foco em transformar uma ideia simples em uma música.', 2, true),
('letra-propria', 'Já escreveu uma letra?', 'Prospecção — Sua letra vira música', 'Você escreve letras? Que tal ouvir uma delas cantada?', 'Olá, {nome}!

Você tem uma letra, um poema ou alguns versos guardados?

Na DCC Music, você pode inserir sua própria letra, escolher o estilo musical e ouvir uma versão transformada em música com inteligência artificial.

É uma forma simples de experimentar diferentes possibilidades para sua composição.

Sua primeira música é grátis para conhecer a ferramenta.

Que tal dar voz a uma letra sua?

Equipe DCC Music', 'Para pessoas que escrevem poemas, versos ou letras.', 3, true),
('homenagem-especial', 'Música para homenagear', 'Prospecção — Uma homenagem em música', 'Uma homenagem especial pode virar música', 'Olá, {nome}!

Um aniversário, uma história de amor ou uma lembrança em família pode inspirar uma música única.

Na DCC Music, você conta a história, escolhe um estilo e usa inteligência artificial para transformar sua ideia em música.

Pode ser uma surpresa, uma homenagem ou simplesmente um jeito diferente de guardar um momento.

Crie sua primeira música grátis e veja como funciona.

Com carinho,
Equipe DCC Music', 'Ideias para aniversários, família e momentos marcantes.', 4, true),
('sem-saber-cantar', 'Não precisa saber cantar', 'Prospecção — Sem saber cantar', 'Não sabe cantar? Ainda assim pode criar sua música', 'Olá, {nome}!

Você não precisa saber cantar, tocar ou produzir música para tirar uma ideia do papel.

Na DCC Music, basta escrever sua ideia ou colar uma letra, escolher o gênero musical e deixar a inteligência artificial ajudar na criação.

Você pode testar uma música sertaneja, um pagode, um louvor, uma balada e muitos outros estilos.

A primeira música é grátis para experimentar.

Bora criar sua primeira composição?

Equipe DCC Music', 'Remove a objeção de falta de habilidade musical.', 5, true),
('uma-frase-vira-musica', 'E se uma frase virasse música?', 'Prospecção — Uma frase vira música', 'E se uma frase sua virasse música?', 'Olá, {nome}!

Pense em uma frase que tenha significado para você.

Agora imagine essa frase virando música.

Com a DCC Music, você escreve sua ideia, escolhe o estilo e cria uma música usando inteligência artificial.

Quer testar? Sua primeira música é grátis.

Equipe DCC Music', 'Mensagem curta e curiosa, pensada para leitura no celular.', 6, true)
ON CONFLICT (slug) DO NOTHING;
