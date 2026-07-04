import { NextRequest, NextResponse } from 'next/server'
import { isSoundCloudUrl, isSpotifyUrl } from '@/lib/spotify-utils'

export const dynamic = 'force-dynamic'

/**
 * API Route para buscar imagem do Spotify via oEmbed
 * Isso evita problemas de CORS e permite cachear as imagens
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const spotifyUrl = searchParams.get('url')
    
    if (!spotifyUrl) {
      return NextResponse.json(
        { error: 'URL do Spotify não fornecida' },
        { status: 400 }
      )
    }

    if (!isSpotifyUrl(spotifyUrl) && !isSoundCloudUrl(spotifyUrl)) {
      return NextResponse.json({ imageUrl: null }, { status: 200 })
    }

    if (isSoundCloudUrl(spotifyUrl)) {
      const oembedUrl = `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(spotifyUrl)}`
      const response = await fetch(oembedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
        },
      })

      if (!response.ok) {
        return NextResponse.json({ imageUrl: null }, { status: 200 })
      }

      const data = await response.json()

      return NextResponse.json({
        imageUrl: data.thumbnail_url || null,
      })
    }
    
    // Buscar via oEmbed do Spotify
    const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(spotifyUrl)}`
    const response = await fetch(oembedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
    })
    
    if (!response.ok) {
      return NextResponse.json(
        { imageUrl: null },
        { status: 200 }
      )
    }
    
    const data = await response.json()
    
    // Retornar a URL da imagem
    return NextResponse.json({
      imageUrl: data.thumbnail_url || null,
    })
  } catch (error: any) {
    console.error('Erro ao buscar imagem do Spotify:', error)
    return NextResponse.json(
      { imageUrl: null, details: error.message },
      { status: 200 }
    )
  }
}
