import type { ComposerEmailLanguage } from './composer-email-language'

const COPY = {
  pt: {
    greeting: 'Olá', welcomeSubject: 'Bem-vindo à DCC Music', welcomeTitle: 'Bem-vindo', welcomeBody: 'Seu e-mail foi confirmado e sua conta de compositor está pronta.', dashboard: 'Acessar meu painel',
    creditsSubject: 'Créditos adicionados ao seu Studio IA', creditsTitle: 'Créditos liberados no Studio IA', creditsAdded: 'Foram adicionados', creditsMusics: 'música(s)', creditsDestination: 'ao seu Studio IA.', reason: 'Motivo', studio: 'Acessar Studio IA',
    lowCreditsSubject: 'Seu saldo do Studio IA está baixo', lowCreditsTitle: 'Saldo baixo no Studio IA', lowCreditsBody: 'Seu saldo atual é de', credits: 'créditos', about: 'cerca de', topups: 'Ver recargas',
    readySubject: 'Sua música "%s" ficou pronta', readyTitle: 'Sua música ficou pronta', readyBody: 'A música', readyAvailable: 'já está disponível no seu Studio IA.', projectCode: 'Código do projeto', openStudio: 'Abrir Studio IA',
    commentSubject: 'Novo comentário em sua música', commentTitle: 'Novo comentário recebido', commentedOn: 'comentou em', viewSong: 'Ver música',
    paymentSubject: 'Pagamento confirmado na DCC Music', paymentTitle: 'Pagamento confirmado', paymentBody: 'Confirmamos o pagamento de', value: 'Valor', paymentId: 'ID do pagamento',
    subscriptionSubject: 'Seu plano DCC Music está perto do vencimento', subscriptionTitle: 'Seu plano está perto do vencimento', subscriptionBody: 'Seu plano', expires: 'vence em', days: 'dia(s)', plans: 'Ver planos',
    deletedSubject: 'Sua conta foi excluída da DCC Music', deletedTitle: 'Conta excluída conforme solicitado', deletedBody: 'Confirmamos que sua conta de compositor foi excluída da DCC Music.',
  },
  en: {
    greeting: 'Hi', welcomeSubject: 'Welcome to DCC Music', welcomeTitle: 'Welcome', welcomeBody: 'Your email has been confirmed and your songwriter account is ready.', dashboard: 'Open my dashboard',
    creditsSubject: 'Credits added to your AI Studio', creditsTitle: 'Credits added to AI Studio', creditsAdded: 'We added', creditsMusics: 'song(s)', creditsDestination: 'to your AI Studio.', reason: 'Reason', studio: 'Open AI Studio',
    lowCreditsSubject: 'Your AI Studio balance is low', lowCreditsTitle: 'Low AI Studio balance', lowCreditsBody: 'Your current balance is', credits: 'credits', about: 'about', topups: 'View top-ups',
    readySubject: 'Your song "%s" is ready', readyTitle: 'Your song is ready', readyBody: 'Your song', readyAvailable: 'is now available in your AI Studio.', projectCode: 'Project code', openStudio: 'Open AI Studio',
    commentSubject: 'New comment on your song', commentTitle: 'New comment received', commentedOn: 'commented on', viewSong: 'View song',
    paymentSubject: 'Payment confirmed at DCC Music', paymentTitle: 'Payment confirmed', paymentBody: 'We have confirmed your payment for', value: 'Amount', paymentId: 'Payment ID',
    subscriptionSubject: 'Your DCC Music plan is close to expiring', subscriptionTitle: 'Your plan is close to expiring', subscriptionBody: 'Your', expires: 'plan expires in', days: 'day(s)', plans: 'View plans',
    deletedSubject: 'Your DCC Music account was deleted', deletedTitle: 'Account deleted as requested', deletedBody: 'We have confirmed that your DCC Music songwriter account was deleted.',
  },
  es: {
    greeting: 'Hola', welcomeSubject: 'Bienvenido a DCC Music', welcomeTitle: 'Bienvenido', welcomeBody: 'Tu correo fue confirmado y tu cuenta de compositor está lista.', dashboard: 'Acceder a mi panel',
    creditsSubject: 'Créditos añadidos a tu Studio IA', creditsTitle: 'Créditos liberados en Studio IA', creditsAdded: 'Se añadieron', creditsMusics: 'canción(es)', creditsDestination: 'a tu Studio IA.', reason: 'Motivo', studio: 'Acceder a Studio IA',
    lowCreditsSubject: 'Tu saldo de Studio IA está bajo', lowCreditsTitle: 'Saldo bajo en Studio IA', lowCreditsBody: 'Tu saldo actual es de', credits: 'créditos', about: 'aproximadamente', topups: 'Ver recargas',
    readySubject: 'Tu canción "%s" está lista', readyTitle: 'Tu canción está lista', readyBody: 'La canción', readyAvailable: 'ya está disponible en tu Studio IA.', projectCode: 'Código del proyecto', openStudio: 'Abrir Studio IA',
    commentSubject: 'Nuevo comentario en tu canción', commentTitle: 'Nuevo comentario recibido', commentedOn: 'comentó en', viewSong: 'Ver canción',
    paymentSubject: 'Pago confirmado en DCC Music', paymentTitle: 'Pago confirmado', paymentBody: 'Confirmamos el pago de', value: 'Valor', paymentId: 'ID del pago',
    subscriptionSubject: 'Tu plan de DCC Music está cerca de vencer', subscriptionTitle: 'Tu plan está cerca de vencer', subscriptionBody: 'Tu plan', expires: 'vence en', days: 'día(s)', plans: 'Ver planes',
    deletedSubject: 'Tu cuenta de DCC Music fue eliminada', deletedTitle: 'Cuenta eliminada según lo solicitado', deletedBody: 'Confirmamos que tu cuenta de compositor de DCC Music fue eliminada.',
  },
} as const

export function getComposerEmailCopy(language: ComposerEmailLanguage) {
  return COPY[language]
}
