'use client';

import { SessionProvider } from 'next-auth/react';

/**
 * Wraps React children with NextAuth's SessionProvider to supply authentication session context.
 *
 * @param children - React nodes to be provided with NextAuth session context
 * @returns A JSX element that renders `SessionProvider` around `children`
 */
export default function AuthProvider({ children }: { children: React.ReactNode }) {
    return <SessionProvider>{children}</SessionProvider>;
}
