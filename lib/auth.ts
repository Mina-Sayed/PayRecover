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
import { isDatabaseConnectivityError } from '@/lib/database-errors';
import { requireEnv, validateRequiredEnvVars } from '@/lib/env';
import { callSupabaseRpc } from '@/lib/supabase-rpc';
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

        let user:
          | {
              id: string;
              email: string;
              name: string | null;
              image: string | null;
              hashedPassword: string | null;
            }
          | null;

        try {
          user = await prisma.user.findUnique({
            where: { email },
          });
        } catch (error) {
          if (!isDatabaseConnectivityError(error)) {
            throw error;
          }

          user = await callSupabaseRpc<typeof user>('app_get_auth_user', {
            p_email: email,
            p_secret: requireEnv('PROVIDER_CONFIG_SECRET'),
          });
        }

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
