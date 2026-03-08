import Link from 'next/link';
import { CheckCircle2, MessageCircle, TrendingUp, Clock, ArrowRight, Smartphone, Twitter, Linkedin, Github } from 'lucide-react';

/**
 * Render the PayRecover marketing landing page.
 *
 * Includes a top navigation, hero section with primary CTA, feature cards, pricing plans (Basic and Pro),
 * and a multi-column footer. The component is purely presentational, uses Next.js Link for navigation,
 * Tailwind CSS for styling, and lucide-react icons for visuals.
 *
 * @returns A React element containing the full landing page layout.
 */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Navigation */}
      <nav className="border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight">PayRecover</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/auth/signin" className="text-sm font-medium text-slate-600 hover:text-slate-900">
              Sign In
            </Link>
            <Link href="/auth/signup" className="text-sm font-medium bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors">
              Get Started Free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-sm font-medium mb-8">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500"></span>
          Built for MENA Clinics, Gyms & Coaches
        </div>
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-slate-900 mb-6 max-w-4xl mx-auto leading-tight">
          Stop chasing payments. <br className="hidden md:block" />
          <span className="text-emerald-500">Let automations do it.</span>
        </h1>
        <p className="text-lg text-slate-600 mb-10 max-w-2xl mx-auto">
          Track unpaid invoices, prepare reminder workflows, and move toward a live recovery loop
          without rebuilding your back office from scratch.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/dashboard" className="flex items-center gap-2 bg-emerald-500 text-white px-8 py-4 rounded-xl font-medium hover:bg-emerald-600 transition-colors text-lg w-full sm:w-auto justify-center">
            Start Recovering Payments
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-slate-50 border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Everything you need to get paid on time</h2>
            <p className="text-slate-600 max-w-2xl mx-auto">Set it up once and let our system handle the follow-ups automatically.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md hover:border-slate-200 transition-all duration-300">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-6">
                <Smartphone className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold mb-3">WhatsApp & SMS</h3>
              <p className="text-slate-600">Reach your clients where they actually look. Automated messages sent directly to their phones.</p>
            </div>
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md hover:border-slate-200 transition-all duration-300">
              <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center mb-6">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Smart Scheduling</h3>
              <p className="text-slate-600">Send gentle reminders 3 days before, on the due date, and firmer alerts when overdue.</p>
            </div>
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md hover:border-slate-200 transition-all duration-300">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-6">
                <TrendingUp className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Payment Tracking</h3>
              <p className="text-slate-600">See exactly who owes you what, and track your recovered revenue in a clean dashboard.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">Simple, transparent pricing</h2>
          <p className="text-slate-600 max-w-2xl mx-auto">Choose the plan that fits your business size.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Basic Plan */}
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col hover:shadow-lg transition-shadow duration-300">
            <h3 className="text-2xl font-bold text-slate-900 mb-2">Basic</h3>
            <p className="text-slate-500 mb-6">Perfect for independent coaches and small clinics.</p>
            <div className="mb-8">
              <span className="text-5xl font-bold text-slate-900">$29</span>
              <span className="text-slate-500">/month</span>
            </div>
            <ul className="space-y-4 mb-8 flex-1">
              {['Up to 100 active clients', 'Invoice tracking workspace', 'Reminder template management', 'Business profile settings'].map((feature, i) => (
                <li key={i} className="flex items-center gap-3 text-slate-700">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <Link href="/auth/signup" className="w-full py-3 px-4 bg-slate-100 text-slate-900 font-medium rounded-xl hover:bg-slate-200 transition-colors text-center">
              Start with the MVP
            </Link>
          </div>

          {/* Pro Plan */}
          <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 shadow-xl flex flex-col relative overflow-hidden hover:shadow-2xl transition-shadow duration-300">
            <div className="absolute top-0 right-0 bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg uppercase tracking-wider">
              Most Popular
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Pro</h3>
            <p className="text-slate-400 mb-6">For growing gyms and busy medical centers.</p>
            <div className="mb-8">
              <span className="text-5xl font-bold text-white">$59</span>
              <span className="text-slate-400">/month</span>
            </div>
            <ul className="space-y-4 mb-8 flex-1">
              {['Planned Paymob payment links', 'Planned WATI reminder delivery', 'Future event-backed analytics', 'Custom reminder templates', 'Operational invoice timeline'].map((feature, i) => (
                <li key={i} className="flex items-center gap-3 text-slate-300">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <Link href="/auth/signup" className="w-full py-3 px-4 bg-emerald-500 text-white font-medium rounded-xl hover:bg-emerald-600 transition-colors text-center">
              Join the rollout
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-100 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Brand */}
            <div className="md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
                  <MessageCircle className="w-5 h-5 text-white" />
                </div>
                <span className="font-bold text-lg tracking-tight">PayRecover</span>
              </div>
              <p className="text-sm text-slate-500 mb-4">Automated payment recovery for MENA small businesses.</p>
              <div className="flex items-center gap-3">
                <a href="#" className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                  <Twitter className="w-4 h-4" />
                </a>
                <a href="#" className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                  <Linkedin className="w-4 h-4" />
                </a>
                <a href="#" className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                  <Github className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Product */}
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-4">Product</h4>
              <ul className="space-y-3">
                <li><a href="#" className="text-sm text-slate-500 hover:text-slate-700 transition-colors">Features</a></li>
                <li><a href="#" className="text-sm text-slate-500 hover:text-slate-700 transition-colors">Pricing</a></li>
                <li><a href="#" className="text-sm text-slate-500 hover:text-slate-700 transition-colors">Integrations</a></li>
                <li><a href="#" className="text-sm text-slate-500 hover:text-slate-700 transition-colors">Changelog</a></li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-4">Company</h4>
              <ul className="space-y-3">
                <li><a href="#" className="text-sm text-slate-500 hover:text-slate-700 transition-colors">About</a></li>
                <li><a href="#" className="text-sm text-slate-500 hover:text-slate-700 transition-colors">Blog</a></li>
                <li><a href="#" className="text-sm text-slate-500 hover:text-slate-700 transition-colors">Careers</a></li>
                <li><a href="#" className="text-sm text-slate-500 hover:text-slate-700 transition-colors">Contact</a></li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-4">Legal</h4>
              <ul className="space-y-3">
                <li><a href="#" className="text-sm text-slate-500 hover:text-slate-700 transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="text-sm text-slate-500 hover:text-slate-700 transition-colors">Terms of Service</a></li>
                <li><a href="#" className="text-sm text-slate-500 hover:text-slate-700 transition-colors">Cookie Policy</a></li>
              </ul>
            </div>
          </div>

          <div className="mt-10 pt-8 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-slate-400">&copy; 2026 PayRecover. All rights reserved.</p>
            <p className="text-sm text-slate-400">Made with ❤️ for MENA entrepreneurs</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
