import type { Metadata } from 'next'
import { cookies, headers } from 'next/headers'
import { COUNTRY_COOKIE, getLocaleForCountry, normalizeCountry } from '@/lib/localization'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Termos de Uso | DCC Music',
  description: 'Termos de uso, uso comercial, royalties e direitos aplicáveis às músicas criadas no DCC Studio IA.',
  alternates: { canonical: 'https://www.dccmusic.online/termos-de-uso' },
}

function getTerms(locale: string) {
  if (locale.startsWith('en')) {
    return {
      title: 'Terms of Use',
      updated: 'Last updated: October 7, 2026',
      intro: 'These Terms of Use set the rules for using DCC Music and AI Studio. By using the platform, you agree to these terms.',
      sections: [
        ['1. Platform use', 'DCC Music provides tools to create, organize, publish, and promote songs, lyrics, cover art, videos, and other content. Some features require an account, credits, an active plan, or third-party services.'],
        ['2. User-submitted content', 'You must only submit or use lyrics, audio, voices, images, trademarks, and other content that you own or are authorized to use. You are responsible for not infringing copyright, image rights, trademarks, privacy, or other third-party rights.'],
        ['3. AI Studio songs and commercial use', 'Songs created by the user in AI Studio may be commercially used by that user, including on streaming platforms, social networks, videos, presentations, and other commercial projects, subject to applicable law, third-party rights, and the rules of the platforms used.'],
        ['4. Royalties and DCC Music', 'DCC Music does not require a share of royalties or revenue the user earns from commercially exploiting songs created in AI Studio. External distributors or platforms may charge fees or apply their own rules, which the user must review directly.'],
        ['5. Copyright and AI-generated content', 'Commercial-use permission from DCC Music is not a promise that a work generated wholly or partly by artificial intelligence will qualify for exclusive copyright protection in any country. Copyright availability and scope depend on applicable law, human contribution, and the circumstances of each creation. Project history in DCC Music may help document chronology and organization, but it does not replace official registrations where required.'],
        ['6. Distribution and third-party services', 'Release on Spotify, Apple Music, YouTube, TikTok, Deezer, and other platforms depends on the policies of the distributor and each service. DCC Music may recommend or integrate third-party services, but their commercial terms, acceptance criteria, and fees are set by those providers.'],
        ['7. Credits, plans, and payments', 'Prices, credit amounts, included features, and plan duration are shown on the platform at the time of purchase. Credits and charges follow the rules displayed in the applicable product and payment flow.'],
        ['8. Contact', 'For questions about these terms, usage rights, or your account, contact suporte@dccmusic.online.'],
      ],
    }
  }

  if (locale.startsWith('es')) {
    return {
      title: 'Términos de Uso',
      updated: 'Última actualización: 7 de octubre de 2026',
      intro: 'Estos Términos de Uso establecen las reglas para utilizar DCC Music y Studio IA. Al utilizar la plataforma, aceptas estos términos.',
      sections: [
        ['1. Uso de la plataforma', 'DCC Music ofrece recursos para crear, organizar, publicar y promocionar canciones, letras, portadas, vídeos y otros contenidos. Algunas funciones requieren registro, créditos, un plan activo o servicios de terceros.'],
        ['2. Contenido enviado por el usuario', 'Debes enviar o utilizar únicamente letras, audios, voces, imágenes, marcas y otros contenidos que sean tuyos o para los que tengas autorización. Eres responsable de no infringir derechos de autor, derechos de imagen, marcas, privacidad u otros derechos de terceros.'],
        ['3. Canciones creadas en Studio IA y uso comercial', 'Las canciones creadas por el usuario en Studio IA pueden ser utilizadas comercialmente por ese usuario, incluso en plataformas de streaming, redes sociales, vídeos, presentaciones y otros proyectos comerciales, respetando la legislación aplicable, los derechos de terceros y las reglas de las plataformas utilizadas.'],
        ['4. Royalties y participación de DCC Music', 'DCC Music no exige una participación en los royalties o ingresos que el usuario obtenga con la explotación comercial de las canciones creadas en Studio IA. Los distribuidores externos u otras plataformas pueden cobrar tarifas o aplicar sus propias reglas, que el usuario debe consultar directamente.'],
        ['5. Derechos de autor y contenido generado por IA', 'El permiso de uso comercial concedido por DCC Music no constituye una promesa de que una obra generada total o parcialmente por inteligencia artificial recibirá protección exclusiva de derechos de autor en cualquier país. La existencia y el alcance de esos derechos dependen de la legislación aplicable, de la contribución humana y de las circunstancias de cada creación. El historial del proyecto en DCC Music puede ayudar a documentar la cronología y organización de la creación, pero no sustituye registros oficiales cuando sean necesarios.'],
        ['6. Distribución y servicios de terceros', 'La publicación en Spotify, Apple Music, YouTube, TikTok, Deezer y otras plataformas depende de las políticas de la distribuidora y de cada servicio. DCC Music puede recomendar o integrar servicios de terceros, pero sus condiciones comerciales, criterios de aceptación y posibles tarifas son definidos por esos proveedores.'],
        ['7. Créditos, planes y pagos', 'Los precios, cantidades de créditos, funciones incluidas y duración de los planes se muestran en la plataforma en el momento de la contratación. Los créditos y cobros siguen las reglas indicadas en el producto y en el flujo de pago correspondiente.'],
        ['8. Contacto', 'Si tienes dudas sobre estos términos, derechos de uso o tu cuenta, escribe a suporte@dccmusic.online.'],
      ],
    }
  }

  return {
    title: 'Termos de Uso',
    updated: 'Última atualização: 7 de outubro de 2026',
    intro: 'Estes Termos de Uso estabelecem as regras para utilização da DCC Music e do Studio IA. Ao utilizar a plataforma, você concorda com estes termos.',
    sections: [
      ['1. Uso da plataforma', 'A DCC Music oferece recursos para criação, organização, publicação e divulgação de músicas, letras, capas, vídeos e outros conteúdos. Alguns recursos dependem de cadastro, créditos, plano ativo ou serviços de terceiros.'],
      ['2. Conteúdo enviado pelo usuário', 'Você deve enviar ou utilizar apenas letras, áudios, vozes, imagens, marcas e outros conteúdos que sejam seus ou para os quais tenha autorização. Você é responsável por não violar direitos autorais, direitos de imagem, marcas, privacidade ou outros direitos de terceiros.'],
      ['3. Músicas criadas no Studio IA e uso comercial', 'As músicas criadas pelo usuário no Studio IA podem ser utilizadas comercialmente pelo próprio usuário, inclusive em plataformas de streaming, redes sociais, vídeos, apresentações e outros projetos comerciais, respeitadas as leis aplicáveis, os direitos de terceiros e as regras das plataformas utilizadas.'],
      ['4. Royalties e participação da DCC Music', 'A DCC Music não exige participação nos royalties ou nas receitas que o usuário obtiver com a exploração comercial das músicas criadas no Studio IA. Serviços externos de distribuição ou outras plataformas podem cobrar taxas ou aplicar regras próprias, que devem ser verificadas diretamente pelo usuário.'],
      ['5. Direitos autorais e conteúdo gerado por IA', 'A permissão de uso comercial concedida pela DCC Music não constitui promessa de que uma obra gerada total ou parcialmente por inteligência artificial receberá proteção autoral exclusiva em qualquer país. A existência e a extensão de direitos autorais dependem da legislação aplicável, da contribuição humana e das circunstâncias de cada criação. O histórico do projeto na DCC Music pode auxiliar na organização e comprovação de anterioridade, mas não substitui registros oficiais quando forem necessários.'],
      ['6. Distribuição e serviços de terceiros', 'A publicação no Spotify, Apple Music, YouTube, TikTok, Deezer e outras plataformas depende das políticas da distribuidora e de cada serviço. A DCC Music pode indicar ou integrar serviços de terceiros, mas as condições comerciais, critérios de aceitação e eventuais taxas desses serviços são definidos por eles.'],
      ['7. Créditos, planos e pagamentos', 'Preços, quantidade de créditos, recursos incluídos e duração dos planos são informados na plataforma no momento da contratação. Créditos e cobranças seguem as regras exibidas no produto e no fluxo de pagamento aplicável.'],
      ['8. Contato', 'Em caso de dúvidas sobre estes termos, direitos de uso ou sua conta, entre em contato pelo e-mail suporte@dccmusic.online.'],
    ],
  }
}

export default function TermsPage() {
  const requestHeaders = headers()
  const country = normalizeCountry(
    cookies().get(COUNTRY_COOKIE)?.value ||
    requestHeaders.get('x-dcc-country') ||
    requestHeaders.get('x-vercel-ip-country') ||
    requestHeaders.get('cf-ipcountry')
  )
  const terms = getTerms(getLocaleForCountry(country))

  return (
    <article className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6">
      <h1 className="mb-3 text-3xl font-bold sm:text-4xl">{terms.title}</h1>
      <p className="mb-8 text-sm text-gray-400">{terms.updated}</p>
      <p className="mb-10 leading-relaxed text-gray-300">{terms.intro}</p>

      <div className="space-y-8">
        {terms.sections.map(([title, body]) => (
          <section key={title}>
            <h2 className="mb-3 text-xl font-semibold">{title}</h2>
            <p className="leading-relaxed text-gray-300">{body}</p>
          </section>
        ))}
      </div>

      <a href="mailto:suporte@dccmusic.online" className="mt-10 inline-block break-all text-primary-400 hover:underline">
        suporte@dccmusic.online
      </a>
    </article>
  )
}
