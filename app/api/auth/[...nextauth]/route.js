import NextAuth from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      session.user.id = token.sub
      session.user.role = token.role || 'CUSTOMER'
      return session
    },
    async jwt({ token, user }) {
      if (user) {
        token.role = user.email?.endsWith('@company.com') ? 'AGENT' : 'CUSTOMER'
      }
      return token
    },
  },
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
