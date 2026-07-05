import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import { config } from 'dotenv'

// Carregar variáveis de ambiente do arquivo .env
config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables')
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function main() {
  console.log('🌱 Iniciando seed do Supabase...')

  // Criar usuários admin
  const usersToCreate = [
    {
      email: process.env.ADMIN_EMAIL || 'admin@dccmusic.com',
      password: process.env.ADMIN_PASSWORD || 'admin123',
      name: 'Admin',
    },
    {
      email: 'dcalaca@gmail.com',
      password: '5778',
      name: 'DCC Admin',
    },
  ]

  for (const userData of usersToCreate) {
    const hashedPassword = await bcrypt.hash(userData.password, 10)

    const { data: existingUser } = await supabase
      .from('dccmusic_users')
      .select('id')
      .eq('email', userData.email)
      .single()

    if (!existingUser) {
      const { data: user, error: userError } = await supabase
        .from('dccmusic_users')
        .insert({
          email: userData.email,
          password_hash: hashedPassword, // Usa password_hash se a tabela tiver essa coluna
          name: userData.name,
        })
        .select()
        .single()

      if (userError) {
        console.error(`❌ Erro ao criar usuário ${userData.email}:`, userError)
      } else {
        console.log(`✅ Usuário criado: ${user.email}`)
      }
    } else {
      console.log(`✅ Usuário ${userData.email} já existe`)
    }
  }

  // Criar gêneros
  const genres = [
    { name: 'Pop', slug: 'pop', color: '#ff6b9d' },
    { name: 'Rock', slug: 'rock', color: '#ff4757' },
    { name: 'EDM', slug: 'edm', color: '#5f27cd' },
    { name: 'Hip Hop', slug: 'hip-hop', color: '#00d2d3' },
    { name: 'R&B', slug: 'r-b', color: '#ff9ff3' },
  ]

  for (const genre of genres) {
    const { data: existing } = await supabase
      .from('dccmusic_genres')
      .select('id')
      .eq('slug', genre.slug)
      .single()

    if (!existing) {
      const { error } = await supabase.from('dccmusic_genres').insert(genre)
      if (error) {
        console.error(`❌ Erro ao criar gênero ${genre.name}:`, error)
      } else {
        console.log(`✅ Gênero criado: ${genre.name}`)
      }
    }
  }

  // Buscar IDs dos gêneros
  const { data: genreData } = await supabase.from('dccmusic_genres').select('id, slug')
  const genreMap = new Map(genreData?.map((g) => [g.slug, g.id]) || [])

  // Criar vídeos de exemplo
  const videos = [
    {
      title: 'Exemplo - Música Pop Incrível',
      slug: 'exemplo-video-pop',
      youtube_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      youtube_id: 'dQw4w9WgXcQ',
      genre_id: genreMap.get('pop'),
      description: 'Uma música pop incrível para você ouvir!',
      tags: 'pop, música, exemplo',
      featured: true,
      published_at: new Date('2024-01-15').toISOString(),
      duration: '3:45',
    },
    {
      title: 'Exemplo - Rock Explosivo',
      slug: 'exemplo-video-rock',
      youtube_url: 'https://www.youtube.com/watch?v=kJQP7kiw5Fk',
      youtube_id: 'kJQP7kiw5Fk',
      genre_id: genreMap.get('rock'),
      description: 'Rock pesado e energético!',
      tags: 'rock, energia, exemplo',
      featured: true,
      published_at: new Date('2024-01-10').toISOString(),
      duration: '4:20',
    },
  ]

  for (const video of videos) {
    const { data: existing } = await supabase
      .from('dccmusic_videos')
      .select('id')
      .eq('slug', video.slug)
      .single()

    if (!existing && video.genre_id) {
      const { error } = await supabase.from('dccmusic_videos').insert(video)
      if (error) {
        console.error(`❌ Erro ao criar vídeo ${video.title}:`, error)
      } else {
        console.log(`✅ Vídeo criado: ${video.title}`)
      }
    }
  }

  // Criar músicas de exemplo
  const musics = [
    {
      title: 'Exemplo - Single Pop',
      slug: 'exemplo-musica-pop',
      genre_id: genreMap.get('pop'),
      description: 'Ouça esta música pop incrível nas principais plataformas!',
      tags: 'pop, single, lançamento',
      spotify_url: 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC',
      spotify_embed:
        '<iframe style="border-radius:12px" src="https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC?utm_source=generator" width="100%" height="152" frameBorder="0" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>',
      featured: true,
      published_at: new Date('2024-01-20').toISOString(),
    },
  ]

  for (const music of musics) {
    const { data: existing } = await supabase
      .from('dccmusic_musics')
      .select('id')
      .eq('slug', music.slug)
      .single()

    if (!existing && music.genre_id) {
      const { error } = await supabase.from('dccmusic_musics').insert(music)
      if (error) {
        console.error(`❌ Erro ao criar música ${music.title}:`, error)
      } else {
        console.log(`✅ Música criada: ${music.title}`)
      }
    }
  }

  console.log('🎉 Seed concluído com sucesso!')
  console.log(`\n📧 Logins admin disponíveis:`)
  usersToCreate.forEach((user) => {
    console.log(`   Email: ${user.email}`)
    console.log(`   Senha: ${user.password}`)
  })
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e)
    process.exit(1)
  })
  .finally(() => {
    process.exit(0)
  })
