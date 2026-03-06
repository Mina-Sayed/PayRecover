import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import AuthProvider from './components/auth-provider';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'PayRecover | MENA SME Payment Recovery',
  description: 'Automated WhatsApp & SMS payment reminders for clinics, gyms, and coaches.',
};

/**
 * Root layout component that provides the application's HTML scaffold and authentication context.
 *
 * @param children - The page content to render inside the layout.
 * @returns The root `<html>` element containing the application UI.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans bg-slate-50 text-slate-900 antialiased" suppressHydrationWarning>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
