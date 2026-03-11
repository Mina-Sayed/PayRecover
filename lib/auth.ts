import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import {
  clearAuthFailures,
  getRequestClientIp,
  isAuthRateLimited,
  recordAuthFailure,
} from '@/lib/auth-rate-limit';
import { requireEnv, validateRequiredEnvVars } from '@/lib/env';
import { asEmail, asTrimmedString } from '@/lib/validators';

validateRequiredEnvVars(['AUTH_SECRET', 'AUTH_URL']);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  secret: requireEnv('AUTH_SECRET'),
  trustHost: true,
  pages: {
    signIn: '/auth/signin',
  },
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, request) {
        const email = asEmail(credentials?.email);
        const password = asTrimmedString(credentials?.password);

        if (!email || !password) {
          return null;
        }

        const ipAddress = getRequestClientIp(request);
        if (isAuthRateLimited(email, ipAddress)) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user?.hashedPassword) {
          recordAuthFailure(email, ipAddress);
          return null;
        }

        const isPasswordValid = await bcrypt.compare(
          password,
          user.hashedPassword
        );

        if (!isPasswordValid) {
          recordAuthFailure(email, ipAddress);
          return null;
        }

        clearAuthFailures(email, ipAddress);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id;
      }
      return session;
    },
  },
});
