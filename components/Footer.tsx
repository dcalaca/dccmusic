'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { FiInstagram, FiYoutube, FiMusic, FiMail, FiCopy, FiCheck, FiFacebook } from 'react-icons/fi'
import AdminLoginModal from './AdminLoginModal'

export default function Footer() {
  const [clickCount, setClickCount] = useState(0)
  const [showModal, setShowModal] = useState(false)
  const [showEmail, setShowEmail] = useState(false)
  const [copied, setCopied] = useState(false)
  const [currentYear, setCurrentYear] = useState<number>(2024)
  const email = 'suporte@dccmusic.online'

  useEffect(() => {
    // Definir ano apenas no cliente para evitar hydration mismatch
    setCurrentYear(new Date().getFullYear())
  }, [])

  const handleFooterClick = () => {
    const newCount = clickCount + 1
    setClickCount(newCount)

    if (newCount >= 5) {
      setShowModal(true)
      setClickCount(0)
    }

    // Reset contador após 2 segundos sem cliques
    setTimeout(() => {
      setClickCount(0)
    }, 2000)
  }

  return (
    <>
      <footer 
        onClick={handleFooterClick}
        className="border-t border-gray-800 bg-black/50 mt-auto cursor-pointer"
      >
        <div className="container mx-auto px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-3">
            <div>
              <Image
                src="/logopng.png"
                alt="DCC Music"
                width={150}
                height={50}
                className="h-10 w-auto mb-4"
              />
              <p className="text-gray-400 text-sm">
                Plataforma para ouvir músicas e vídeos, criar com Studio IA, gerar partitura e cifra e divulgar o trabalho de compositores.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Links Rápidos</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="/videos" className="text-gray-400 hover:text-white transition-colors">
                    Vídeos
                  </Link>
                </li>
                <li>
                  <Link href="/musicas" className="text-gray-400 hover:text-white transition-colors">
                    Músicas
                  </Link>
                </li>
                <li>
                  <Link href="/studio-ia" className="text-gray-400 hover:text-white transition-colors">
                    Studio IA
                  </Link>
                </li>
                <li>
                  <Link href="/transcricao-musical" className="text-gray-400 hover:text-white transition-colors">
                    Partitura e Cifra
                  </Link>
                </li>
                <li>
                  <Link href="/distribuicao-digital" className="text-gray-400 hover:text-white transition-colors">
                    Distribuição Digital
                  </Link>
                </li>
                <li>
                  <Link href="/compositores" className="text-gray-400 hover:text-white transition-colors">
                    Compositores
                  </Link>
                </li>
                <li>
                  <Link href="/sobre" className="text-gray-400 hover:text-white transition-colors">
                    Sobre
                  </Link>
                </li>
                <li>
                  <Link href="/faq" className="text-gray-400 hover:text-white transition-colors">
                    FAQ
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Contato</h4>
              <div className="space-y-3">
                {!showEmail ? (
                  <button
                    onClick={() => setShowEmail(true)}
                    className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors text-sm"
                  >
                    <FiMail className="w-5 h-5" />
                    <span>Ver Email</span>
                  </button>
                ) : (
                  <div className="flex items-center space-x-2">
                    <span className="text-gray-300 text-sm">{email}</span>
                    <button
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(email)
                          setCopied(true)
                          setTimeout(() => setCopied(false), 2000)
                        } catch (err) {
                          console.error('Erro ao copiar email:', err)
                        }
                      }}
                      className="text-gray-400 hover:text-white transition-colors"
                      title="Copiar email"
                    >
                      {copied ? (
                        <FiCheck className="w-4 h-4 text-green-400" />
                      ) : (
                        <FiCopy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                )}
                <div className="mt-4 flex flex-wrap gap-3">
                  <a
                    href="https://www.youtube.com/@dcalaca"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-800 bg-gray-950 text-gray-400 transition-colors hover:text-neon-purple"
                    aria-label="YouTube"
                  >
                    <FiYoutube className="w-5 h-5" />
                  </a>
                  <a
                    href="https://www.instagram.com/dccmusic.online/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-800 bg-gray-950 text-gray-400 transition-colors hover:text-neon-purple"
                    aria-label="Instagram"
                  >
                    <FiInstagram className="w-5 h-5" />
                  </a>
                  <a
                    href="https://open.spotify.com/intl-pt/artist/0vMZmxBm682XaehHIIIW9K"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-800 bg-gray-950 text-gray-400 transition-colors hover:text-neon-purple"
                    aria-label="Spotify"
                  >
                    <FiMusic className="w-5 h-5" />
                  </a>
                  <a
                    href="https://www.tiktok.com/@douglascris_?lang=pt-BR"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-gray-800 bg-gray-950 px-3 text-sm font-bold text-gray-400 transition-colors hover:text-neon-purple"
                    aria-label="TikTok"
                  >
                    TikTok
                  </a>
                  <a
                    href="https://www.facebook.com/profile.php?id=61571000874301"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-800 bg-gray-950 text-gray-400 transition-colors hover:text-neon-purple"
                    aria-label="Facebook"
                  >
                    <FiFacebook className="w-5 h-5" />
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-gray-800 text-center text-sm text-gray-400">
            <p>&copy; {currentYear} DCC Music. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>

      <AdminLoginModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </>
  )
}
