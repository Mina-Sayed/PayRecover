import Sidebar from '../components/sidebar';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { ToastProvider } from '../components/toast';
import DashboardSearch from '../components/dashboard-search';
import { Suspense } from 'react';

/**
 * App layout that renders a persistent sidebar, a sticky top header, and a main content area.
 *
 * The layout is wrapped with the toast provider so descendants can show toasts.
 *
 * @param children - The page content to render inside the main content area.
 * @returns The layout element containing the sidebar, header (search, notifications, and exit link), and the provided `children`.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="min-h-screen bg-slate-50 flex">
        {/* Sidebar */}
        <Sidebar />

        {/* Main Content */}
        <main className="flex-1 md:ml-64 flex flex-col min-h-screen">
          {/* Top Header */}
          <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-10">
            <div className="flex items-center gap-4 flex-1">
              {/* spacer for mobile hamburger */}
              <div className="w-10 md:hidden" />
              <Suspense
                fallback={
                  <div className="relative w-full max-w-md hidden sm:block">
                    <input
                      type="text"
                      placeholder="Search clients or invoices..."
                      disabled
                      className="w-full pl-9 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-400"
                    />
                  </div>
                }
              >
                <DashboardSearch />
              </Suspense>
            </div>
            <div className="flex items-center gap-4">
              <button className="relative p-2 text-slate-400 hover:text-slate-600 transition-colors">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
              </button>
              <Link href="/" className="text-sm font-medium text-slate-600 hover:text-slate-900">
                Exit MVP
              </Link>
            </div>
          </header>

          {/* Page Content */}
          <div className="flex-1 p-6 max-w-6xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </ToastProvider>
  );
}
