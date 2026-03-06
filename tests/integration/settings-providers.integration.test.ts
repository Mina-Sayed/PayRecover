/* @vitest-environment jsdom */

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SettingsPage from '@/app/dashboard/settings/page';

const apiFetchMock = vi.fn();

vi.mock('@/lib/client-api', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

vi.mock('@/app/components/toast', () => ({
  useToast: () => ({
    addToast: vi.fn(),
  }),
}));

vi.mock('@/app/components/skeleton', () => ({
  default: ({ className }: { className?: string }) =>
    React.createElement('div', { 'data-testid': 'skeleton', className }),
}));

vi.mock('motion/react', async () => {
  const ReactModule = await import('react');

  const motion = new Proxy(
    {},
    {
      get: (_target, tagName: string) =>
        ({ children, ...props }: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) =>
          ReactModule.createElement(tagName, props, children),
    }
  );

  return {
    motion,
    AnimatePresence: ({ children }: { children?: React.ReactNode }) =>
      ReactModule.createElement(ReactModule.Fragment, null, children),
  };
});

describe('settings provider selection', () => {
  it('shows Paymob and WATI as the chosen rollout providers', async () => {
    apiFetchMock.mockResolvedValue({
      name: 'Mina',
      email: 'mina@example.com',
      businessName: 'PayRecover',
      whatsappNumber: '+201000000000',
      plan: 'free',
    });

    render(React.createElement(SettingsPage));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith('/api/settings');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Integrations' }));

    expect(await screen.findByText('Paymob')).toBeTruthy();
    expect(screen.getByText('WATI')).toBeTruthy();
    expect(screen.getByText(/PAYMOB_PUBLIC_KEY/)).toBeTruthy();
    expect(screen.getByText(/WATI_WEBHOOK_SECRET/)).toBeTruthy();
  });
});
