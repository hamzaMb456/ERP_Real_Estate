// Integration: TWO-ORGANIZATION isolation, end to end through the dispatcher on Floci.
// Seeds two full, independent organizations (A and B), then proves in both directions that:
//   - staff of org A see only org A rows (and symmetrically for B);
//   - staff of org A reading an org B id get null / an empty list — never B data;
//   - writes on foreign rows are refused (contact_not_found, unit_not_found, ...);
//   - the public catalog of one organization never contains the other's listings.
// Fixtures use random ids and stay in the dev tables (same policy as the other integration tests).
import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { useDevTables } from '../domain/test-env.ts';

const ready = await useDevTables();
const { doc, table } = await import('../domain/db.ts');
const { dispatch } = await import('./dispatch.ts');
const { syncPublicListing } = await import('../domain/public-listings.ts');
const { PutCommand } = await import('@aws-sdk/lib-dynamodb');

const ORG_A = randomUUID();
const ORG_B = randomUUID();
const put = (model: string, item: Record<string, unknown>) =>
  doc.send(new PutCommand({ TableName: table(model), Item: { __typename: model, created_at: '2026-01-01T00:00:00Z', updated_at: 'x', ...item } }));

interface Org {
  tag: string; org: string; staff: string; branch: string; property: string; unit: string;
  contact: string; lease: string; visit: string; appointment: string; notification: string;
}

function seedOrg(tag: string, org: string): Org {
  return {
    tag, org, staff: randomUUID(), branch: randomUUID(), property: randomUUID(),
    unit: randomUUID(), contact: randomUUID(), lease: randomUUID(), visit: randomUUID(),
    appointment: randomUUID(), notification: randomUUID(),
  };
}

const [A, B] = [seedOrg('A', ORG_A), seedOrg('B', ORG_B)];
const fixturesOf = (o: Org, leaseNumber: number): Array<[string, Record<string, unknown>]> => [
  ['Organization', { id: o.org, name: `Org ${o.tag}` }],
  ['StaffMember', { id: o.staff, organization_id: o.org, display_name: `Admin ${o.tag}`, email: `admin-${o.tag.toLowerCase()}@example.test`, role: 'org_admin' }],
  ['Branch', { id: o.branch, organization_id: o.org, name: `Agence ${o.tag}`, city: 'Tunis' }],
  ['Property', { id: o.property, organization_id: o.org, branch_id: o.branch, name: `Résidence ${o.tag}`, type: 'building', city: 'Aouina' }],
  ['Unit', { id: o.unit, organization_id: o.org, property_id: o.property, code: `${o.tag}-1`, type: 'apartment', status: 'vacant', rent_amount: o.tag === 'A' ? 1850 : 2100, show_on_website: true, title: `S+2 ${o.tag}` }],
  ['FileLink', { id: randomUUID(), organization_id: o.org, target_key: `unit#${o.unit}`, unit_id: o.unit, storage_file_id: `photo-${o.tag}`, kind: 'photo', title: 'photo', is_cover: true, sort_order: 1 }],
  ['Contact', { id: o.contact, organization_id: o.org, full_name: `Locataire ${o.tag}` }],
  ['Lease', { id: o.lease, organization_id: o.org, number: leaseNumber, status: 'active', start_date: '2026-06-01', end_date: '2027-05-31', unit_ids: [o.unit], signed_at: '2026-05-20', rents: [], terms: [] }],
  ['VisitRequest', { id: o.visit, organization_id: o.org, unit_id: o.unit, visit_date: '2026-11-05', visit_time: '10:00', full_name: `Visiteur ${o.tag}`, phone: '98 111 222', status: 'new' }],
  ['Appointment', { id: o.appointment, organization_id: o.org, kind: 'viewing', title: `Visite ${o.tag}`, starts_at: '2026-11-03T09:00:00Z', ends_at: '2026-11-03T10:00:00Z', status: 'planned', unit_id: o.unit, assigned_user_id: o.staff }],
  ['Notification', { id: o.notification, organization_id: o.org, user_id: o.staff, kind: 'visit_request', title: `Demande ${o.tag}`, link: '/visites', dedupe_key: `twoorg:${o.tag}:${o.notification}`, read_at: null }],
];

const adminA = { role: 'org_admin', userId: A.staff, orgId: ORG_A };
const adminB = { role: 'org_admin', userId: B.staff, orgId: ORG_B };
const pub = { role: 'public', userId: '', orgId: '' };
const call = async (who: { role: string; userId: string; orgId: string }, field: 'run' | 'exec', op: string, variables: Record<string, unknown> = {}) =>
  JSON.parse(await dispatch(field, { op, variables: JSON.stringify(variables) }, who));
const publicListingsOf = async (org: string) => {
  const r = await call(pub, 'run', 'PublicLatestListings', {
    where: { _and: [{ organization_id: { _eq: org } }] }, orderBy: [{ published_at: 'desc_nulls_last' }], limit: 20,
  });
  return r.listings as Array<{ id: string; organization_id: string }>;
};

before(async () => {
  if (!ready) return;
  for (const [o, n] of [[A, 9001], [B, 9002]] as const) {
    for (const [model, item] of fixturesOf(o, n)) await put(model, item);
    assert.equal(await syncPublicListing(o.unit), 'listed');
  }
});

test('two-organization isolation', { skip: !ready && 'Floci dev tables not reachable' }, async (t) => {
  const jsonOf = (v: unknown): string => JSON.stringify(v);

  await t.test('each org sees its own units, and only its own', async () => {
    const ua = await call(adminA, 'run', 'UnitsOverview', {});
    const ub = await call(adminB, 'run', 'UnitsOverview', {});
    const ids = (r: { units: Array<{ id: string }> }) => r.units.map((u) => u.id);
    assert.deepEqual(ids(ua), [A.unit]);
    assert.deepEqual(ids(ub), [B.unit]);
  });

  await t.test('contact lists and dashboard counts are scoped per org', async () => {
    const ca = await call(adminA, 'run', 'Contacts', {});
    const cb = await call(adminB, 'run', 'Contacts', {});
    assert.equal(jsonOf(ca).includes(B.contact), false);
    assert.equal(jsonOf(cb).includes(A.contact), false);
    const da = await call(adminA, 'run', 'Dashboard', { today: '2026-10-28', dayStart: '2000-01-01', dayEnd: '2100-01-01' });
    assert.equal(da.contacts_aggregate.aggregate.count, 1);
    assert.deepEqual(da.properties.map((p: { id: string }) => p.id), [A.property]);
  });

  await t.test('leases: list is scoped, foreign detail reads answer null (never B data)', async () => {
    const la = await call(adminA, 'run', 'Leases', {});
    assert.equal(jsonOf(la).includes(B.lease), false);
    assert.deepEqual(jsonOf(la).includes(A.lease), true);
    // Detail reads of a foreign id return null (the "not found" contract), never the other org's row.
    assert.equal((await call(adminA, 'run', 'Lease', { id: B.lease })).lease, null);
    assert.equal((await call(adminB, 'run', 'Lease', { id: A.lease })).lease, null);
    // Own detail reads still work.
    assert.equal((await call(adminA, 'run', 'Lease', { id: A.lease })).lease.id, A.lease);
  });

  await t.test('units and contacts: foreign detail reads answer null', async () => {
    assert.equal((await call(adminA, 'run', 'Unit', { id: B.unit })).unit, null);
    assert.equal((await call(adminB, 'run', 'Unit', { id: A.unit })).unit, null);
    assert.equal((await call(adminA, 'run', 'Contact', { id: B.contact })).contact, null);
    assert.equal((await call(adminB, 'run', 'Contact', { id: A.contact })).contact, null);
    // Own reads work.
    assert.equal((await call(adminA, 'run', 'Unit', { id: A.unit })).unit.id, A.unit);
  });

  await t.test('calendar feed of one org never carries the other org events', async () => {
    const feedA = await call(adminA, 'run', 'CalendarFeed', { from: '2000-01-01T00:00:00Z', to: '2100-01-01T00:00:00Z' });
    const text = jsonOf(feedA);
    assert.equal(text.includes(B.appointment), false);
    assert.equal(text.includes(B.lease), false);
    assert.equal(text.includes(A.appointment), true);
  });

  await t.test('notifications are per user, never cross org', async () => {
    const na = await call(adminA, 'run', 'Notifications', {});
    const text = jsonOf(na);
    assert.equal(text.includes(`Demande ${A.tag}`), true);
    assert.equal(text.includes(`Demande ${B.tag}`), false);
  });

  await t.test('foreign writes are refused, own writes work', async () => {
    // B rows, A caller: every write answers the domain's not_found.
    await assert.rejects(call(adminA, 'exec', 'UpdateContact', { id: B.contact, set: { notes: 'pirate' } }), /contact_not_found/);
    await assert.rejects(call(adminA, 'exec', 'UpdateUnit', { id: B.unit, set: { rent_amount: 1 } }), /unit_not_found/);
    await assert.rejects(call(adminA, 'exec', 'SetLeaseArchived', { id: B.lease }), /lease_not_found/);
    await assert.rejects(call(adminA, 'exec', 'SetVisitRequest', { id: B.visit, set: { status: 'declined' } }), /request_not_found/);
    await assert.rejects(call(adminA, 'exec', 'InsertAppointment', {
      appointment: { id: randomUUID(), kind: 'viewing', title: 'Pirate', starts_at: '2026-11-04T09:00:00Z', ends_at: '2026-11-04T10:00:00Z', unit_id: B.unit },
      participants: [],
    }), /unit_not_found/);
    // Own rows: the same operations work.
    await call(adminA, 'exec', 'UpdateContact', { id: A.contact, set: { notes: 'note-A' } });
    await call(adminB, 'exec', 'UpdateContact', { id: B.contact, set: { notes: 'note-B' } });
    const ca = await call(adminA, 'run', 'Contact', { id: A.contact });
    assert.equal(ca.contact.notes, 'note-A');
    const cb = await call(adminB, 'run', 'Contact', { id: B.contact });
    assert.equal(cb.contact.notes, 'note-B');
  });

  await t.test('the public catalog of one org never contains the other org listings', async () => {
    const a = await publicListingsOf(ORG_A);
    const b = await publicListingsOf(ORG_B);
    assert.deepEqual(a.map((l) => l.id), [A.unit]);
    assert.deepEqual(b.map((l) => l.id), [B.unit]);
    // Without an organization the public API refuses (public_org_required).
    await assert.rejects(call(pub, 'run', 'PublicLatestListings', { where: {}, orderBy: [], limit: 5 }), /public_org_required/);
  });
});
