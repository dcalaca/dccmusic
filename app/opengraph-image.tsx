import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'DCC Music — Sua ideia vira música'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: '100%', height: '100%', background: 'linear-gradient(130deg, #090713 0%, #251047 52%, #080c23 100%)', color: 'white', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', position: 'relative', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', position: 'absolute', width: 700, height: 700, borderRadius: '100%', background: 'rgba(147,51,234,0.15)', top: -350, right: -180 }} />
        <div style={{ display: 'flex', fontSize: 98, fontWeight: 900, letterSpacing: -4, color: '#ffffff', textShadow: '0 0 24px #9333ea' }}>DCC MUSIC</div>
        <div style={{ display: 'flex', width: 170, height: 7, borderRadius: 8, background: 'linear-gradient(90deg, #a855f7, #22d3ee)', marginTop: 24, marginBottom: 30 }} />
        <div style={{ display: 'flex', fontSize: 48, fontWeight: 700 }}>Sua ideia vira música</div>
        <div style={{ display: 'flex', fontSize: 30, color: '#d8c9f5', marginTop: 22 }}>Crie sua primeira música grátis com IA</div>
        <div style={{ display: 'flex', fontSize: 23, color: '#a9a5b8', marginTop: 56 }}>www.dccmusic.online</div>
      </div>
    ),
    size
  )
}
