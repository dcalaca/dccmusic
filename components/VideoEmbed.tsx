'use client'

import { useEffect, useState } from 'react'
import YouTubeEmbed from './YouTubeEmbed'

interface VideoEmbedProps {
  youtubeId: string
  youtubeEmbed?: string | null
}

export default function VideoEmbed({ youtubeId, youtubeEmbed }: VideoEmbedProps) {
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    setIsLoaded(true)
  }, [])

  if (!isLoaded) {
    return (
      <div className="relative w-full aspect-video bg-gray-900 rounded-lg flex items-center justify-center">
        <div className="text-gray-400">Carregando vídeo...</div>
      </div>
    )
  }

  // Se tiver código de embed customizado, usar ele
  if (youtubeEmbed && typeof youtubeEmbed === 'string' && youtubeEmbed.trim()) {
    try {
      // Processar o HTML do embed para tornar o iframe responsivo
      let processedEmbed = youtubeEmbed.trim()
      
      // Remover width e height fixos do iframe
      processedEmbed = processedEmbed.replace(/width="\d+"/gi, '')
      processedEmbed = processedEmbed.replace(/height="\d+"/gi, '')
      
      // Garantir que o iframe tenha style responsivo
      if (processedEmbed.includes('<iframe')) {
        // Se não tiver style, adicionar
        if (!processedEmbed.includes('style=')) {
          processedEmbed = processedEmbed.replace(
            /<iframe/gi,
            '<iframe style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;"'
          )
        } else {
          // Se já tiver style, garantir que tenha as propriedades necessárias
          processedEmbed = processedEmbed.replace(
            /style="([^"]*)"/gi,
            (match, existingStyle) => {
              try {
                let newStyle = existingStyle.trim()
                if (!newStyle.endsWith(';')) newStyle += ';'
                
                // Adicionar propriedades se não existirem
                if (!newStyle.includes('position')) newStyle += ' position: absolute;'
                if (!newStyle.includes('top:')) newStyle += ' top: 0;'
                if (!newStyle.includes('left:')) newStyle += ' left: 0;'
                if (!newStyle.includes('width:') || !newStyle.includes('width: 100%')) {
                  newStyle = newStyle.replace(/width:\s*\d+px/gi, '')
                  newStyle += ' width: 100%;'
                }
                if (!newStyle.includes('height:') || !newStyle.includes('height: 100%')) {
                  newStyle = newStyle.replace(/height:\s*\d+px/gi, '')
                  newStyle += ' height: 100%;'
                }
                if (!newStyle.includes('border')) newStyle += ' border: 0;'
                
                return `style="${newStyle}"`
              } catch (e) {
                // Se houver erro no processamento, retornar o original
                return match
              }
            }
          )
        }
      }
      
      return (
        <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-gray-900">
          <div
            className="absolute inset-0 w-full h-full"
            dangerouslySetInnerHTML={{ __html: processedEmbed }}
          />
        </div>
      )
    } catch (error) {
      // Se houver erro no processamento, usar o componente padrão
      console.error('Erro ao processar embed customizado:', error)
      return <YouTubeEmbed videoId={youtubeId} />
    }
  }

  // Caso contrário, usar o componente padrão
  return <YouTubeEmbed videoId={youtubeId} />
}
