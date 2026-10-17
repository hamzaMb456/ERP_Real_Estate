import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { QueryState } from '@/lib/use-graphql';

const useGraphql = vi.fn();
const graphql = vi.fn();
const showError = vi.fn();
vi.mock('@/lib/use-graphql', () => ({ useGraphql: (...args: unknown[]) => useGraphql(...args) }));
vi.mock('@/lib/graphql', () => ({ graphql: (...args: unknown[]) => graphql(...args) }));
vi.mock('@/lib/show-error', () => ({ showError: (...args: unknown[]) => showError(...args) }));

import { NotificationBell } from './notification-bell';

type Row = {
  id: string;
  kind: string;
  title: string;
  link: string | null;
  lease_id: string | null;
  appointment_id: string | null;
  read_at: string | null;
  created_at: string;
};

const row = (patch: Partial<Row> = {}): Row => ({
  id: 'N1',
  kind: 'lease_expired',
  title: 'Bail 12',
  link: null,
  lease_id: 'L12',
  appointment_id: null,
  read_at: null,
  created_at: '2026-10-16T09:30:00Z',
  ...patch,
});

const success = (notifications: Row[], unread: number): QueryState<unknown> => ({
  status: 'success',
  data: { notifications, notifications_aggregate: { aggregate: { count: unread } } },
});

beforeEach(() => {
  useGraphql.mockReset();
  graphql.mockReset().mockResolvedValue({});
  showError.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(document, 'hidden');
});

describe('NotificationBell', () => {
  it('shows the unread count on the badge and in the accessible name', () => {
    useGraphql.mockReturnValue(success([row()], 3));
    render(<NotificationBell />);
    expect(screen.getByRole('button', { name: 'Notifications, 3 non lues' })).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('uses the singular for one unread notification', () => {
    useGraphql.mockReturnValue(success([row()], 1));
    render(<NotificationBell />);
    expect(screen.getByRole('button', { name: 'Notifications, 1 non lue' })).toBeInTheDocument();
  });

  it('caps the badge at 99+', () => {
    useGraphql.mockReturnValue(success([row()], 150));
    render(<NotificationBell />);
    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  it('hides the badge when everything is read', () => {
    useGraphql.mockReturnValue(success([row({ read_at: '2026-10-16T10:00:00Z' })], 0));
    render(<NotificationBell />);
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
    expect(screen.queryByText('0')).toBeNull();
  });

  it('shows an empty state when there is no notification', async () => {
    useGraphql.mockReturnValue(success([], 0));
    render(<NotificationBell />);
    await userEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(await screen.findByText('Vous êtes à jour. Aucune notification.')).toBeInTheDocument();
  });

  it('lists the French label, the title and links each row to its target', async () => {
    useGraphql.mockReturnValue(success([row(), row({ id: 'N2', kind: 'appointment_reminder', title: 'Visite', lease_id: null, appointment_id: 'A5' })], 2));
    render(<NotificationBell />);
    await userEvent.click(screen.getByRole('button', { name: /^Notifications/ }));
    const lease = await screen.findByRole('menuitem', { name: /Bail expiré/ });
    expect(lease).toHaveAttribute('href', '/baux/L12');
    expect(lease).toHaveTextContent('Bail 12');
    expect(screen.getByRole('menuitem', { name: /Rappel de rendez-vous/ })).toHaveAttribute('href', '/calendrier?rendezvous=A5');
  });

  it('marks all as read with one mutation, then reloads', async () => {
    useGraphql.mockReturnValue(success([row()], 1));
    render(<NotificationBell />);
    await userEvent.click(screen.getByRole('button', { name: /^Notifications/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Tout marquer comme lu' }));
    await waitFor(() => expect(graphql).toHaveBeenCalledTimes(1));
    expect(graphql.mock.calls[0][0]).toContain('update_notifications');
    expect(graphql.mock.calls[0][1]).toEqual({ now: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) });
    await waitFor(() => expect(useGraphql.mock.lastCall?.[2]).toBe(1));
  });

  it('reports a failed mark-all through showError', async () => {
    graphql.mockRejectedValue(new Error('boom'));
    useGraphql.mockReturnValue(success([row()], 1));
    render(<NotificationBell />);
    await userEvent.click(screen.getByRole('button', { name: /^Notifications/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Tout marquer comme lu' }));
    await waitFor(() => expect(showError).toHaveBeenCalledTimes(1));
  });

  it('marks a single unread notification as read when it is clicked', async () => {
    useGraphql.mockReturnValue(success([row()], 1));
    render(<NotificationBell />);
    await userEvent.click(screen.getByRole('button', { name: /^Notifications/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /Bail expiré/ }));
    await waitFor(() => expect(graphql).toHaveBeenCalledTimes(1));
    expect(graphql.mock.calls[0][0]).toContain('update_notifications_by_pk');
    expect(graphql.mock.calls[0][1]).toMatchObject({ id: 'N1' });
  });

  it('polls every 60 seconds by bumping the reload key, and stops on unmount', () => {
    vi.useFakeTimers();
    useGraphql.mockReturnValue(success([], 0));
    const { unmount } = render(<NotificationBell />);
    expect(useGraphql.mock.lastCall?.[2]).toBe(0);
    act(() => void vi.advanceTimersByTime(60_000));
    expect(useGraphql.mock.lastCall?.[2]).toBe(1);
    unmount();
    const calls = useGraphql.mock.calls.length;
    act(() => void vi.advanceTimersByTime(180_000));
    expect(useGraphql.mock.calls.length).toBe(calls);
  });

  it('does not poll while the tab is hidden', () => {
    vi.useFakeTimers();
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    useGraphql.mockReturnValue(success([], 0));
    render(<NotificationBell />);
    act(() => void vi.advanceTimersByTime(120_000));
    expect(useGraphql.mock.lastCall?.[2]).toBe(0);
  });
});
