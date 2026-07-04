import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { supabaseAdmin } from './supabase'
import bcrypt from 'bcryptjs'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        // Primeiro, tentar autenticação via variáveis de ambiente (prioridade)
        const adminEmail = process.env.ADMIN_EMAIL
        const adminPassword = process.env.ADMIN_PASSWORD

        if (adminEmail && adminPassword) {
          if (credentials.email === adminEmail && credentials.password === adminPassword) {
            return {
              id: 'admin',
              email: adminEmail,
              name: 'DCC Admin',
            }
          }
        }

        // Fallback: tentar autenticação via tabela dccmusic_users
        try {
          const { data: user, error } = await supabaseAdmin
            .from('dccmusic_users')
            .select('*')
            .eq('email', credentials.email.toLowerCase().trim())
            .maybeSingle()

          if (error) {
            console.error('[AUTH] Erro ao buscar usuário:', error)
          }

          if (user && user.password_hash) {
            // Verificar senha usando bcrypt
            const isValid = await bcrypt.compare(credentials.password, user.password_hash)
            
            if (isValid) {
              return {
                id: user.id || 'admin',
                email: user.email,
                name: user.name || 'DCC Admin',
              }
            }
          }
        } catch (error) {
          console.error('[AUTH] Erro ao autenticar via tabela:', error)
        }

        console.error('[AUTH] Credenciais inválidas para:', credentials.email)
        return null
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/admin/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
      }
      return session
    },
  },
}
