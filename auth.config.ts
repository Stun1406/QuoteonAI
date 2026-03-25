import type { NextAuthConfig } from 'next-auth'

// Edge-compatible config — no Node.js-only modules here
export const authConfig: NextAuthConfig = {
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isLoginPage = nextUrl.pathname === '/login'
      const isApiAuth = nextUrl.pathname.startsWith('/api/auth')

      const isLandingPage = nextUrl.pathname === '/'
      const isWebhook = nextUrl.pathname.startsWith('/api/webhooks/')

      if (isApiAuth) return true
      if (isLandingPage) return true
      if (isWebhook) return true
      if (isLoginPage) {
        if (isLoggedIn) return Response.redirect(new URL('/app', nextUrl))
        return true
      }
      if (!isLoggedIn) return false

      // /ops requires manager or admin
      if (nextUrl.pathname.startsWith('/ops')) {
        const role = (auth?.user as { role?: string })?.role
        return role === 'manager' || role === 'admin'
      }

      return true
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as { role?: string }).role ?? 'staff'
        token.name = user.name
        token.email = user.email
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        ;(session.user as { role?: string }).role = token.role as string
      }
      return session
    },
  },
  providers: [], // filled in auth.ts
}
