import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { Locale } from '@/i18n/config';
import { I18nProvider } from '@/i18n/provider';
import { activateLocale, setLocale } from '@/i18n/store';
import type { QueryState } from '@/lib/use-graphql';

const useGraphql = vi.fn();
vi.mock('@/lib/use-graphql', () => ({ useGraphql: (...args: unknown[]) => useGraphql(...args) }));
vi.mock('@/lib/graphql', () => ({ graphql: vi.fn().mockResolvedValue({}) }));
vi.mock('@/lib/show-error', () => ({ showError: vi.fn() }));

import { NotificationBell } from './notification-bell';

const row = {
  id: 'N1',
  kind: 'lease_expired',
  title: 'Bail 12',
  link: null,
  lease_id: 'L12',
  appointment_id: null,
  read_at: null,
  created_at: '2026-10-16T09:30:00Z',
};

const success = (unread: number): QueryState<unknown> => ({
  status: 'success',
  data: { notifications: [row], notifications_aggregate: { aggregate: { count: unread } } },
});

function renderIn(locale: Locale, ui: ReactNode = <NotificationBell />) {
  act(() => setLocale(locale));
  return render(<I18nProvider>{ui}</I18nProvider>);
}

beforeEach(() => useGraphql.mockReset());

afterEach(() => {
  act(() => setLocale('fr'));
  activateLocale('fr');
});

describe('NotificationBell in English', () => {
  it('names the bell with the unread count', () => {
    useGraphql.mockReturnValue(success(3));
    renderIn('en');
    expect(screen.getByRole('button', { name: 'Notifications, 3 unread' })).toBeInTheDocument();
  });

  it('lists the English kind, the time and the mark-all action', async () => {
    useGraphql.mockReturnValue(success(1));
    renderIn('en');
    await userEvent.click(screen.getByRole('button', { name: 'Notifications, 1 unread' }));
    const item = await screen.findByRole('menuitem', { name: /Lease expired/ });
    expect(item).toHaveTextContent('Bail 12');
    expect(item).toHaveTextContent('Unread');
    expect(within(item).getByText('16/10/2026, 10:30')).toHaveAttribute('dir', 'ltr');
    expect(screen.getByRole('menuitem', { name: 'Mark all as read' })).toBeInTheDocument();
  });

  it('shows the empty state of the shell dictionary', async () => {
    useGraphql.mockReturnValue({ status: 'success', data: { notifications: [], notifications_aggregate: { aggregate: { count: 0 } } } });
    renderIn('en');
    await userEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(await screen.findByText('You are all caught up. No notifications.')).toBeInTheDocument();
  });
});

describe('NotificationBell in Arabic', () => {
  it('reads the count with the Arabic plural and places the badge with logical properties', () => {
    useGraphql.mockReturnValue(success(3));
    renderIn('ar');
    expect(screen.getByRole('button', { name: 'الإشعارات، 3 إشعارات غير مقروءة' })).toBeInTheDocument();
    const badge = screen.getByText('3');
    expect(badge.className).toContain('-end-0.5');
    expect(badge.className).not.toMatch(/\b-?(right|left)-/);
    expect(badge).toHaveAttribute('aria-hidden');
    expect(badge).toHaveAttribute('dir', 'ltr');
  });

  it('uses the dual form for two unread notifications', () => {
    useGraphql.mockReturnValue(success(2));
    renderIn('ar');
    expect(screen.getByRole('button', { name: 'الإشعارات، إشعاران غير مقروءين' })).toBeInTheDocument();
  });

  it('opens a right-to-left menu in Arabic', async () => {
    useGraphql.mockReturnValue(success(1));
    renderIn('ar');
    await userEvent.click(screen.getByRole('button', { name: 'الإشعارات، إشعار واحد غير مقروء' }));
    const menu = await screen.findByRole('menu');
    expect(menu).toHaveAttribute('dir', 'rtl');
    expect(within(menu).getByText('الإشعارات')).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: /عقد إيجار منتهي الصلاحية/ })).toHaveAttribute('href', '/baux/L12');
    expect(within(menu).getByRole('menuitem', { name: 'تعليم الكل كمقروء' })).toBeInTheDocument();
  });
});

describe('NotificationBell first load', () => {
  it('shows a skeleton while loading', async () => {
    useGraphql.mockReturnValue({ status: 'loading' });
    renderIn('fr');
    await userEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Chargement…');
  });

  it('reports a failed first load and retries by bumping the reload key', async () => {
    useGraphql.mockReturnValue({ status: 'error', message: 'boom' });
    renderIn('fr');
    await userEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Impossible de charger les notifications.');
    expect(useGraphql.mock.lastCall?.[2]).toBe(0);
    await userEvent.click(screen.getByRole('menuitem', { name: 'Réessayer' }));
    expect(useGraphql.mock.lastCall?.[2]).toBe(1);
  });
});
