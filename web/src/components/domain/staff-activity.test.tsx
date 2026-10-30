import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { I18nProvider } from '@/i18n/provider';
import { StaffActivity } from './staff-activity';

const names = { 'staff-9': 'Amel', 'manager-1': 'Karim' };
const row = (over: Record<string, unknown> = {}) => ({
  id: 'r1', user_id: 'staff-9', kind: 'created', actor_user_id: 'manager-1', created_at: '2026-10-30T10:00:00.000Z', detail: null, ...over,
});

function setup(rows: ReturnType<typeof row>[]) {
  render(
    <I18nProvider>
      <StaffActivity rows={rows} names={names} />
    </I18nProvider>,
  );
}

describe('StaffActivity', () => {
  it('says there is no activity when the list is empty', () => {
    setup([]);
    expect(screen.getByText('Aucune activité.')).toBeInTheDocument();
  });

  it('words each kind of event and names the person and the actor', () => {
    setup([row(), row({ id: 'r2', kind: 'mfa_reset' }), row({ id: 'r3', kind: 'activated', actor_user_id: 'staff-9' })]);
    expect(screen.getByText(/Compte créé/)).toBeInTheDocument();
    expect(screen.getByText(/Authentificateur réinitialisé/)).toBeInTheDocument();
    expect(screen.getByText(/Compte activé/)).toBeInTheDocument();
    expect(screen.getAllByText(/Amel/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Karim/).length).toBeGreaterThan(0);
  });

  it('falls back to the raw kind for an event it does not know', () => {
    setup([row({ kind: 'something_new' })]);
    expect(screen.getByText(/something_new/)).toBeInTheDocument();
  });
});
