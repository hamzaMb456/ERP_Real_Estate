import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AppointmentStatus, EmailStatus } from '@/lib/appointment-types';

vi.mock('./appointment-mutations', () => ({ resendParticipantMutation: vi.fn() }));
vi.mock('@/lib/show-error', () => ({ showError: vi.fn() }));

import type { AppointmentDetails } from './appointment-details';
import { AppointmentParticipantsList } from './appointment-participants-list';

const participant = (emailStatus: EmailStatus, email: string | null = 'sami@example.tn'): AppointmentDetails['participants'][number] => ({
  contact_id: 'C1',
  role: 'renter',
  email_status: emailStatus,
  contact: { id: 'C1', full_name: 'Sami Ben Ali', email },
});

function renderList(options: {
  participants: AppointmentDetails['participants'];
  notifyByEmail?: boolean;
  appointmentStatus?: AppointmentStatus;
  canEdit?: boolean;
}) {
  return render(
    <AppointmentParticipantsList
      appointmentId="A1"
      participants={options.participants}
      notifyByEmail={options.notifyByEmail ?? true}
      appointmentStatus={options.appointmentStatus ?? 'planned'}
      canEdit={options.canEdit ?? true}
      onChanged={() => {}}
    />,
  );
}

describe('AppointmentParticipantsList e-mail labels', () => {
  it('shows « E-mail désactivé » for a skipped participant when e-mails are off', () => {
    renderList({ participants: [participant('skipped')], notifyByEmail: false });
    expect(screen.getByText('E-mail désactivé')).toBeInTheDocument();
    expect(screen.queryByText('Pas d’adresse e-mail')).not.toBeInTheDocument();
  });

  it('shows « Pas d’adresse e-mail » when e-mails are on and the contact has no address', () => {
    renderList({ participants: [participant('skipped', null)], notifyByEmail: true });
    expect(screen.getByText('Pas d’adresse e-mail')).toBeInTheDocument();
  });
});

describe('AppointmentParticipantsList « Renvoyer »', () => {
  it('is offered for a failed e-mail on a planned appointment', () => {
    renderList({ participants: [participant('failed')], appointmentStatus: 'planned' });
    expect(screen.getByRole('button', { name: 'Renvoyer' })).toBeInTheDocument();
  });

  it.each<AppointmentStatus>(['cancelled', 'done'])('is hidden when the appointment is %s', (status) => {
    renderList({ participants: [participant('failed')], appointmentStatus: status });
    expect(screen.getByText('E-mail non envoyé')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Renvoyer' })).not.toBeInTheDocument();
  });

  it('is hidden for people who cannot edit', () => {
    renderList({ participants: [participant('failed')], canEdit: false });
    expect(screen.queryByRole('button', { name: 'Renvoyer' })).not.toBeInTheDocument();
  });
});
