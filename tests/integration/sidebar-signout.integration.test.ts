/* @vitest-environment jsdom */

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Sidebar from '@/app/components/sidebar';

const pushMock = vi.fn();
const refreshMock = vi.fn();
const signOutMock = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock,
  }),
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: {
      user: {
        name: 'Mina Sayed',
        email: 'mina@example.com',
      },
    },
  }),
  signOut: (...args: unknown[]) => signOutMock(...args),
}));

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children?: React.ReactNode }) =>
    React.createElement('a', { href, ...props }, children),
}));

describe('sidebar sign out', () => {
  beforeEach(() => {
    pushMock.mockReset();
    refreshMock.mockReset();
    signOutMock.mockReset();
  });

  it('signs out without relying on server redirect URLs', async () => {
    signOutMock.mockResolvedValue({ url: 'http://localhost:3000' });

    render(React.createElement(Sidebar));

    fireEvent.click(screen.getByTitle('Sign out'));

    await waitFor(() => {
      expect(signOutMock).toHaveBeenCalledWith({ redirect: false });
    });

    expect(pushMock).toHaveBeenCalledWith('/');
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });
});
