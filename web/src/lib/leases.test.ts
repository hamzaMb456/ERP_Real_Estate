import { describe, expect, it } from 'vitest';
import type { LeaseDraftInput, LeaseOverviewRow } from './lease-types';
import {
  buildLeaseObjects,
  describeRegistration,
  formatLeaseNumber,
  leaseFlags,
  leasePeriod,
  matchesLeaseSearch,
  matchesLeaseTab,
  parseMoney,
  planRenewalRents,
  validateLeaseDraft,
} from './leases';

describe('parseMoney', () => {
  it.each([
    ['980', 980],
    ['980,5', 980.5],
    ['980.5', 980.5],
    ['1 250,500', 1250.5],
    ['1 250,500', 1250.5],
    ['1 250,500', 1250.5],
    ['1.250,500', 1250.5],
    ['1,250.500', 1250.5],
    ['0', 0],
  ])('reads %j as %d', (text, expected) => {
    expect(parseMoney(text)).toBe(expected);
  });

  it.each([[''], ['  '], ['abc'], ['-5'], ['12,5,3'], ['1.250.500'], ['5 TND']])('refuses %j', (text) => {
    expect(parseMoney(text)).toBeNull();
  });
});

const valid: LeaseDraftInput = {
  startDate: '2026-11-01',
  endDate: '2027-10-31',
  paymentDay: '5',
  depositAmount: '1 500',
  units: [{ unitId: 'u1', rent: '900', charges: '' }],
  renters: ['c1'],
  guarantors: ['c2'],
};

describe('validateLeaseDraft', () => {
  it('accepts a complete lease', () => {
    expect(validateLeaseDraft(valid)).toBeNull();
  });

  it.each([
    [{ startDate: '' }, 'Indiquez la date de début.'],
    [{ endDate: '' }, 'Indiquez la date de fin.'],
    [{ endDate: '2026-11-01' }, 'La date de fin doit suivre la date de début.'],
    [{ paymentDay: '31' }, 'Le jour de paiement doit être compris entre 1 et 28.'],
    [{ paymentDay: 'x' }, 'Le jour de paiement doit être compris entre 1 et 28.'],
    [{ depositAmount: 'beaucoup' }, 'Le dépôt de garantie n’est pas un montant valide.'],
    [{ units: [] }, 'Choisissez au moins une unité.'],
    [{ units: [{ unitId: 'u1', rent: '', charges: '' }] }, 'Indiquez le loyer de chaque unité.'],
    [{ units: [{ unitId: 'u1', rent: '900', charges: 'x' }] }, 'Les charges d’une unité ne sont pas un montant valide.'],
    [{ renters: [] }, 'Ajoutez au moins un locataire.'],
    [{ renters: [null] }, 'Choisissez un contact pour chaque ligne.'],
    [{ guarantors: [null] }, 'Choisissez un contact pour chaque ligne.'],
  ])('refuses %j', (patch, message) => {
    expect(validateLeaseDraft({ ...valid, ...patch })).toBe(message);
  });

  it('refuses the same contact as renter and guarantor, or twice as renter', () => {
    const message = 'Un même contact ne peut apparaître qu’une fois sur le bail (locataire ou garant).';
    expect(validateLeaseDraft({ ...valid, guarantors: ['c1'] })).toBe(message);
    expect(validateLeaseDraft({ ...valid, renters: ['c1', 'c1'], guarantors: [] })).toBe(message);
  });

  it('treats a blank deposit and blank charges as zero', () => {
    expect(validateLeaseDraft({ ...valid, depositAmount: '', units: [{ unitId: 'u1', rent: '900', charges: '' }] })).toBeNull();
  });
});

describe('buildLeaseObjects', () => {
  it('builds the objects of the four insert fields', () => {
    const built = buildLeaseObjects('L1', {
      ...valid,
      depositAmount: '1 500,5',
      units: [
        { unitId: 'u1', rent: '900,5', charges: '40' },
        { unitId: 'u2', rent: '700', charges: '' },
      ],
      renters: ['c1'],
      guarantors: ['c2'],
    });
    expect(built.set).toEqual({ start_date: '2026-11-01', end_date: '2027-10-31', payment_day: 5, deposit_amount: 1500.5 });
    expect(built.units).toEqual([
      { lease_id: 'L1', unit_id: 'u1' },
      { lease_id: 'L1', unit_id: 'u2' },
    ]);
    expect(built.parties).toEqual([
      { lease_id: 'L1', contact_id: 'c1', role: 'renter' },
      { lease_id: 'L1', contact_id: 'c2', role: 'guarantor' },
    ]);
    expect(built.rents).toEqual([
      { lease_id: 'L1', unit_id: 'u1', effective_from: '2026-11-01', rent_amount: 900.5, charges_amount: 40 },
      { lease_id: 'L1', unit_id: 'u2', effective_from: '2026-11-01', rent_amount: 700, charges_amount: 0 },
    ]);
  });
});

const row = (patch: Partial<LeaseOverviewRow> = {}): LeaseOverviewRow => ({
  id: 'L1',
  number: 12,
  status: 'active',
  start_date: '2026-01-01',
  end_date: '2026-12-31',
  unit_count: 1,
  unit_codes: 'B-203',
  renter_names: 'SARL Carthage Digital',
  total_rent: 1250,
  total_charges: 60,
  is_ending_soon: false,
  in_grace: false,
  grace_days_left: null,
  registration_state: 'registered',
  registration_deadline: '2026-03-01',
  ...patch,
});

describe('tabs and search', () => {
  it('sorts leases into the five tabs', () => {
    const rows = [
      row({ id: 'a' }),
      row({ id: 'b', status: 'draft' }),
      row({ id: 'c', is_ending_soon: true }),
      row({ id: 'd', in_grace: true }),
      row({ id: 'e', status: 'ended' }),
      row({ id: 'f', status: 'expired' }),
    ];
    const ids = (tab: Parameters<typeof matchesLeaseTab>[1]) => rows.filter((r) => matchesLeaseTab(r, tab)).map((r) => r.id);
    expect(ids('all')).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
    expect(ids('active')).toEqual(['a', 'c', 'd']);
    expect(ids('draft')).toEqual(['b']);
    expect(ids('renew')).toEqual(['c', 'd']);
    expect(ids('ended')).toEqual(['e', 'f']);
  });

  it('finds a lease by number, unit or renter, ignoring case', () => {
    expect(matchesLeaseSearch(row(), '')).toBe(true);
    expect(matchesLeaseSearch(row(), '12')).toBe(true);
    expect(matchesLeaseSearch(row(), 'b-203')).toBe(true);
    expect(matchesLeaseSearch(row(), 'carthage')).toBe(true);
    expect(matchesLeaseSearch(row(), 'zzz')).toBe(false);
  });

  it('formats the number and the period', () => {
    expect(formatLeaseNumber(12)).toBe('Bail N° 12');
    expect(leasePeriod(row())).toBe('01/01/2026 → 31/12/2026');
  });
});

describe('leaseFlags', () => {
  const today = '2026-10-15';

  it('has no flag for a healthy lease', () => {
    expect(leaseFlags(row(), today)).toEqual([]);
  });

  it('announces the end of the lease', () => {
    const labels = (endDate: string) => leaseFlags(row({ is_ending_soon: true, end_date: endDate }), today).map((f) => f.label);
    expect(labels('2026-11-04')).toEqual(['Fin dans 20 jours']);
    expect(labels('2026-10-16')).toEqual(['Fin demain']);
    expect(labels('2026-10-15')).toEqual(['Fin aujourd’hui']);
  });

  it('shows the grace week with the days left', () => {
    expect(leaseFlags(row({ in_grace: true, grace_days_left: 4, end_date: '2026-10-12' }), today)).toEqual([
      { key: 'grace', label: 'Échu · à renouveler (4 j)', tone: 'warning' },
    ]);
  });

  it('warns about the registration only in the last days or when overdue (see also describeRegistration)', () => {
    expect(leaseFlags(row({ registration_state: 'pending', registration_deadline: '2026-12-01' }), today)).toEqual([]);
    expect(leaseFlags(row({ registration_state: 'due_soon', registration_deadline: '2026-10-20' }), today)).toEqual([
      { key: 'registration', label: 'Enregistrement avant le 20/10/2026', tone: 'warning' },
    ]);
    expect(leaseFlags(row({ registration_state: 'overdue', registration_deadline: '2026-10-01' }), today)).toEqual([
      { key: 'registration', label: 'Enregistrement en retard (échéance 01/10/2026)', tone: 'danger' },
    ]);
  });
});

describe('planRenewalRents', () => {
  const current = [{ unit_id: 'u1', rent_amount: 900, charges_amount: 40 }];

  it('sends nothing when no rent changed', () => {
    expect(planRenewalRents([{ unitId: 'u1', rent: '900', charges: '40' }], current)).toEqual({ rents: null });
  });

  it('sends only the units whose rent or charges changed, reading comma decimals', () => {
    expect(planRenewalRents([{ unitId: 'u1', rent: '925,5', charges: '40' }], current)).toEqual({
      rents: [{ unit_id: 'u1', rent_amount: 925.5, charges_amount: 40 }],
    });
    expect(planRenewalRents([{ unitId: 'u1', rent: '900', charges: '' }], current)).toEqual({
      rents: [{ unit_id: 'u1', rent_amount: 900, charges_amount: 0 }],
    });
  });

  it('refuses an amount that is not a number', () => {
    expect(planRenewalRents([{ unitId: 'u1', rent: 'x', charges: '' }], current)).toEqual({
      error: 'Les loyers et charges doivent être des montants valides.',
    });
  });
});

describe('describeRegistration', () => {
  const today = '2026-10-15';
  const base = {
    status: 'active' as const,
    registration_state: 'pending' as const,
    registration_deadline: '2026-12-01',
    registered_at: null,
    registration_receipt: null,
  };

  it('shows a registered lease with its receipt', () => {
    expect(
      describeRegistration({ ...base, registration_state: 'registered', registered_at: '2026-09-01', registration_receipt: 'REC-12' }, today),
    ).toEqual({ tone: 'success', text: 'Enregistré le 01/09/2026 · Reçu REC-12' });
    expect(describeRegistration({ ...base, registration_state: 'registered', registered_at: '2026-09-01' }, today).text).toBe(
      'Enregistré le 01/09/2026',
    );
  });

  it('stays calm while the deadline is far', () => {
    expect(describeRegistration(base, today)).toEqual({ tone: 'neutral', text: 'À enregistrer avant le 01/12/2026.' });
  });

  it('warns in the last days and counts them', () => {
    const due = { ...base, registration_state: 'due_soon' as const, registration_deadline: '2026-10-20' };
    expect(describeRegistration(due, today)).toEqual({ tone: 'warning', text: 'À enregistrer avant le 20/10/2026 : plus que 5 jours.' });
    expect(describeRegistration({ ...due, registration_deadline: '2026-10-16' }, today).text).toBe(
      'À enregistrer avant le 16/10/2026 : plus que 1 jour.',
    );
    expect(describeRegistration({ ...due, registration_deadline: '2026-10-15' }, today).text).toBe(
      'À enregistrer avant le 15/10/2026 : dernier jour.',
    );
  });

  it('flags a late registration', () => {
    expect(describeRegistration({ ...base, registration_state: 'overdue', registration_deadline: '2026-10-01' }, today)).toEqual({
      tone: 'danger',
      text: 'En retard : à enregistrer avant le 01/10/2026.',
    });
  });

  it('explains the draft and the unregistered ended lease', () => {
    expect(describeRegistration({ ...base, status: 'draft', registration_state: 'not_applicable', registration_deadline: null }, today).text).toBe(
      'Disponible après l’activation du bail.',
    );
    expect(describeRegistration({ ...base, status: 'ended', registration_state: 'not_applicable' }, today).text).toBe('Bail non enregistré.');
  });
});
