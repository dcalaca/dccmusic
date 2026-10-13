import type { AppLocale } from './config'
import { referralMessages } from './referral-messages'

const ptRules = referralMessages['pt-BR']
const enRules = referralMessages['en-US']
const esRules = referralMessages['es-ES']
const pt = {
  metaTitle: 'Indique e ganhe créditos para criar músicas',
  metaDescription: 'Convide seus amigos para a DCC Music. Ganhe 10 créditos quando seu amigo fizer a primeira compra aprovada. Ele ganha 5 créditos extras. Confira as regras.',
  intro: 'Sua música impressionou alguém? Convide essa pessoa para criar a dela. Na primeira compra aprovada do seu amigo, vocês dois ganham créditos.',
  yourBonus: 'Você ganha 10 créditos', friendBonus: 'Seu amigo ganha 5 créditos',
  openDashboard: 'Ver meu link e minhas indicações',
  accessNote: 'Entre na sua conta. O acesso também fica no menu da sua foto.',
  trackingTitle: 'Acompanhe tudo em um só lugar',
  trackingDescription: 'Na sua página, você vê os cliques no seu link, os cadastros, as primeiras compras aprovadas e os créditos ganhos. Escolha o período e consulte o histórico, com 10 indicações por página. Os créditos liberados entram no seu saldo para criar músicas.',
  questionsTitle: 'Dúvidas sobre o Indique e ganhe', allQuestions: 'Ver todas as perguntas frequentes',
  questions: [
    { question: 'Como faço para indicar um amigo?', answer: 'Entre na sua conta, clique na sua foto e escolha “Indique e ganhe”. Copie seu link exclusivo ou toque em “Enviar no WhatsApp”. Seu amigo precisa acessar esse link antes de se cadastrar.' },
    { question: 'Quantos créditos eu e meu amigo ganhamos?', answer: ptRules.ruleBonus },
    { question: 'Ganho créditos só pelo cadastro?', answer: 'Não. O cadastro aparece no histórico, mas os créditos só são liberados após a primeira compra paga e aprovada do amigo. Os dois também precisam confirmar o e-mail.' },
    { question: 'Quais compras participam?', answer: ptRules.ruleFirstPurchase },
    { question: 'Existe um limite de indicações premiadas?', answer: ptRules.ruleLimit },
    { question: 'Até quando meu amigo pode se cadastrar?', answer: ptRules.ruleWindow },
    { question: 'Por que meus créditos estão pendentes?', answer: ptRules.ruleVerification },
    { question: 'O que acontece se a compra for cancelada?', answer: ptRules.ruleRefund },
    { question: 'Posso receber o bônus em dinheiro ou indicar a mim mesmo?', answer: ptRules.ruleCredits },
  ],
}
const en = {
  metaTitle: 'Refer friends and earn credits to create music',
  metaDescription: 'Invite friends to DCC Music. Earn 10 credits when your friend makes their first approved purchase. They get 5 extra credits. Read the rules.',
  intro: 'Did your song impress someone? Invite them to create their own. When your friend makes their first approved purchase, you both earn credits.',
  yourBonus: 'You earn 10 credits', friendBonus: 'Your friend earns 5 credits',
  openDashboard: 'See my link and referrals', accessNote: 'Sign in to your account. You can also access it from your profile photo menu.',
  trackingTitle: 'Track everything in one place',
  trackingDescription: 'Your page shows link clicks, sign-ups, approved first purchases and credits earned. Choose a period and browse the history, with 10 referrals per page. Available credits are added to your balance to create music.',
  questionsTitle: 'Refer and earn questions', allQuestions: 'See all frequently asked questions',
  questions: [
    { question: 'How do I refer a friend?', answer: 'Sign in, click your profile photo and choose “Refer and earn”. Copy your personal link or choose “Send on WhatsApp”. Your friend must open this link before signing up.' },
    { question: 'How many credits do we each earn?', answer: enRules.ruleBonus },
    { question: 'Do I earn credits just for a sign-up?', answer: 'No. The sign-up appears in your history, but credits are released only after your friend’s first paid and approved purchase. Both people must also verify their email.' },
    { question: 'Which purchases qualify?', answer: enRules.ruleFirstPurchase },
    { question: 'Is there a monthly reward limit?', answer: enRules.ruleLimit },
    { question: 'How long does my friend have to sign up?', answer: enRules.ruleWindow },
    { question: 'Why are my credits pending?', answer: enRules.ruleVerification },
    { question: 'What if the purchase is cancelled?', answer: enRules.ruleRefund },
    { question: 'Can I receive cash or refer myself?', answer: enRules.ruleCredits },
  ],
}
const es = {
  metaTitle: 'Invita amigos y gana créditos para crear música',
  metaDescription: 'Invita amigos a DCC Music. Gana 10 créditos cuando tu amigo haga su primera compra aprobada. Él recibe 5 créditos extra. Consulta las reglas.',
  intro: '¿Tu canción impresionó a alguien? Invítalo a crear la suya. En la primera compra aprobada de tu amigo, ambos ganan créditos.',
  yourBonus: 'Tú ganas 10 créditos', friendBonus: 'Tu amigo gana 5 créditos',
  openDashboard: 'Ver mi enlace y mis invitaciones', accessNote: 'Inicia sesión. También puedes acceder desde el menú de tu foto de perfil.',
  trackingTitle: 'Sigue todo en un solo lugar',
  trackingDescription: 'Tu página muestra clics, registros, primeras compras aprobadas y créditos ganados. Elige un período y consulta el historial, con 10 invitaciones por página. Los créditos disponibles se agregan a tu saldo para crear música.',
  questionsTitle: 'Dudas sobre Invita y gana', allQuestions: 'Ver todas las preguntas frecuentes',
  questions: [
    { question: '¿Cómo invito a un amigo?', answer: 'Inicia sesión, pulsa tu foto y elige “Invita y gana”. Copia tu enlace exclusivo o pulsa “Enviar por WhatsApp”. Tu amigo debe abrir este enlace antes de registrarse.' },
    { question: '¿Cuántos créditos ganamos?', answer: esRules.ruleBonus },
    { question: '¿Gano créditos solo por el registro?', answer: 'No. El registro aparece en el historial, pero los créditos se liberan después de la primera compra pagada y aprobada del amigo. Ambos deben verificar su correo.' },
    { question: '¿Qué compras participan?', answer: esRules.ruleFirstPurchase },
    { question: '¿Hay un límite mensual de premios?', answer: esRules.ruleLimit },
    { question: '¿Hasta cuándo puede registrarse mi amigo?', answer: esRules.ruleWindow },
    { question: '¿Por qué mis créditos están pendientes?', answer: esRules.ruleVerification },
    { question: '¿Qué pasa si se cancela la compra?', answer: esRules.ruleRefund },
    { question: '¿Puedo recibir dinero o invitarme a mí mismo?', answer: esRules.ruleCredits },
  ],
}
export const referralHelpMessages: Record<AppLocale, typeof en> = {
  'pt-BR': pt, 'pt-PT': pt, 'en-US': en, 'en-GB': en,
  'es-ES': es, 'es-MX': es, 'es-CO': es, 'es-PY': es,
}
