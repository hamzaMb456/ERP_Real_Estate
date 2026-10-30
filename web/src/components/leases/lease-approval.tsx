'use client';

import { useT } from '@/i18n/provider';

export type ApprovalMessages = ReturnType<typeof useT>['leases']['approvals'];

/** A missing item from the backend (`deposit_amount`, `unit:{id}:deposit_months`, `doc:signed_lease`), in words. */
export function missingLabel(item: string, a: ApprovalMessages): string {
  if (item === 'deposit_amount') return a.missingItems.deposit;
  if (item.endsWith(':deposit_months')) return a.missingItems.unitDeposit;
  if (item.endsWith(':reservation_deposit')) return a.missingItems.unitReservation;
  if (item.startsWith('doc:')) return a.missingItems.doc[item.slice(4) as keyof typeof a.missingItems.doc] ?? item;
  return item;
}

/** Outcome of the latest activation request, shown on the lease page to the staff who asked and to the manager. */
export function LeaseApprovalBanner({ approval }: { approval: { status: string; missing: string[]; decision_note: string | null; decided_at: string | null } | null }) {
  const t = useT();
  const a = t.leases.approvals;
  if (!approval) return null;

  if (approval.status === 'pending') {
    return (
      <div role="status" className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
        <p>{a.banner.pending}</p>
        {approval.missing.length > 0 && (
          <p className="mt-1 text-muted-foreground">{approval.missing.map((item) => missingLabel(item, a)).join(' · ')}</p>
        )}
      </div>
    );
  }
  if (approval.status === 'approved') {
    const date = approval.decided_at ? new Date(approval.decided_at).toLocaleDateString() : '';
    return (
      <div role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm">
        <p>{a.banner.approved(date)}</p>
      </div>
    );
  }
  return (
    <div role="status" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      <p>{a.banner.rejected}</p>
      {approval.decision_note && <p className="mt-1">{a.banner.note} : {approval.decision_note}</p>}
    </div>
  );
}
