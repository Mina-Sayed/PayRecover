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

describe('settings provider connections', () => {
  it('shows real WATI and Paymob connection actions in the integrations tab', async () => {
    apiFetchMock.mockResolvedValue({
      name: 'Mina',
      email: 'mina@example.com',
      businessName: 'PayRecover',
      whatsappNumber: '+201000000000',
      plan: 'free',
      notificationPrefs: {
        paymentReceived: true,
        dailySummary: true,
        overdueAlerts: true,
      },
      messagingConnection: {
        id: null,
        provider: 'wati',
        mode: 'sandbox',
        status: 'not_connected',
        accountLabel: null,
        senderIdentifier: null,
        verifiedAt: null,
        lastHealthcheckAt: null,
        lastError: null,
        hasConfig: false,
        configPreview: null,
      },
      paymentConnection: {
        id: null,
        provider: 'paymob',
        mode: 'sandbox',
        status: 'not_connected',
        accountLabel: null,
        verifiedAt: null,
        lastHealthcheckAt: null,
        lastError: null,
        hasConfig: false,
        configPreview: null,
      },
    });

    render(React.createElement(SettingsPage));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith('/api/settings');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Integrations' }));

    expect(await screen.findByText('Paymob')).toBeTruthy();
    expect(screen.getByText('WATI')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save WATI Connection' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Verify WATI' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save Paymob Connection' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Verify Paymob' })).toBeTruthy();
  });

  it('shows persisted notification controls in the notifications tab', async () => {
    apiFetchMock.mockReset();
    apiFetchMock.mockResolvedValue({
      name: 'Mina',
      email: 'mina@example.com',
      businessName: 'PayRecover',
      whatsappNumber: '+201000000000',
      plan: 'free',
      notificationPrefs: {
        paymentReceived: false,
        dailySummary: true,
        overdueAlerts: false,
      },
      messagingConnection: {
        id: null,
        provider: 'wati',
        mode: 'sandbox',
        status: 'not_connected',
        accountLabel: null,
        senderIdentifier: null,
        verifiedAt: null,
        lastHealthcheckAt: null,
        lastError: null,
        hasConfig: false,
        configPreview: null,
      },
      paymentConnection: {
        id: null,
        provider: 'paymob',
        mode: 'sandbox',
        status: 'not_connected',
        accountLabel: null,
        verifiedAt: null,
        lastHealthcheckAt: null,
        lastError: null,
        hasConfig: false,
        configPreview: null,
      },
    });

    render(React.createElement(SettingsPage));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith('/api/settings');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));

    expect(await screen.findByRole('button', { name: 'Save Notifications' })).toBeTruthy();
    expect(screen.getByText(/stored on your tenant profile/i)).toBeTruthy();
  });
});
