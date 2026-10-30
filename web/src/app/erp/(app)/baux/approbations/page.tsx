'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { missingLabel } from '@/components/leases/lease-approval';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useT } from '@/i18n/provider';
import { graphql } from '@/lib/graphql';
import { toUserMessage } from '@/lib/errors';
import { useCanManage } from '@/lib/use-can-edit';
import { useGraphql } from '@/lib/use-graphql';

type LeaseApproval = {
  id: string;
  lease_id: string;
  requested_at: string;
  signed_on?: string | null;
  decided_at?: string | null;
  status?: string;
  decision_note?: string | null;
  missing: string[];
  lease_number: number | null;
  unit_labels: string[];
  party_names?: string[];
};

const LEASE_APPROVALS_QUERY = `
  query LeaseApprovals {
    lease_approvals {
      id lease_id requested_at signed_on missing lease_number unit_labels party_names
    }
  }
`;

const MY_LEASE_APPROVALS_QUERY = `
  query MyLeaseApprovals {
    lease_approvals {
      id lease_id requested_at decided_at status decision_note missing lease_number unit_labels
    }
  }
`;

const DECIDE_LEASE_APPROVAL = `
  mutation DecideLeaseApproval($id: uuid!, $decision: String!, $note: String) {
    update_lease_approvals_by_pk(pk_columns: { id: $id }) { id }
  }
`;

/** « Approbations de bail »: the manager's queue of activations; for regional staff, the status of their own requests. */
export default function LeaseApprovalsPage() {
  const t = useT();
  const a = t.leases.approvals;
  const canManage = useCanManage();
  const [reload, setReload] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const result = useGraphql<{ lease_approvals: LeaseApproval[] }>(
    canManage ? LEASE_APPROVALS_QUERY : MY_LEASE_APPROVALS_QUERY,
    undefined,
    reload,
  );
  const refresh = useCallback(() => setReload((value) => value + 1), []);

  async function decide(id: string, decision: 'approve' | 'reject') {
    setBusyId(id);
    try {
      await graphql(DECIDE_LEASE_APPROVAL, { id, decision, note: decision === 'reject' ? reasons[id]?.trim() || null : null });
      toast.success(a.done);
      refresh();
    } catch (error) {
      toast.error(toUserMessage(error));
    } finally {
      setBusyId(null);
    }
  }

  const rows = result.status === 'success' ? result.data.lease_approvals : [];

  return (
    <div className="space-y-6">
      <PageHeader title={canManage ? a.title : a.mineTitle} description={canManage ? a.intro : a.mineIntro} />
      {result.status === 'loading' && <p className="text-sm text-muted-foreground">…</p>}
      {result.status === 'error' && <p className="text-sm text-destructive">{result.message}</p>}
      {result.status === 'success' && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">{canManage ? a.empty : a.mineEmpty}</p>
      )}
      {result.status === 'success' && rows.length > 0 && (
        <ul className="space-y-3">
          {rows.map((approval) => {
            const pending = (approval.status ?? 'pending') === 'pending';
            return (
              <li key={approval.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p className="font-medium">{a.lease(approval.lease_number)}</p>
                    <p className="text-sm text-muted-foreground">
                      {approval.unit_labels.join(', ')}
                      {approval.party_names && approval.party_names.length > 0 ? ` · ${approval.party_names.join(', ')}` : ''}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {a.requestedOn} {new Date(approval.requested_at).toLocaleDateString()}
                    </p>
                    {!canManage && approval.status && (
                      <p className="text-sm">
                        <span className="font-medium">{a.status[approval.status as keyof typeof a.status] ?? approval.status}</span>
                        {approval.decided_at ? ` · ${a.decidedOn} ${new Date(approval.decided_at).toLocaleDateString()}` : ''}
                      </p>
                    )}
                    {!canManage && approval.decision_note && (
                      <p className="text-sm">
                        {a.banner.note} : {approval.decision_note}
                      </p>
                    )}
                    {pending && approval.missing.length > 0 && (
                      <p className="text-sm">
                        <span className="font-medium">{a.missing} : </span>
                        {approval.missing.map((item) => missingLabel(item, a)).join(' · ')}
                      </p>
                    )}
                  </div>
                  {canManage && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        className="w-64"
                        aria-label={a.rejectReason}
                        placeholder={a.rejectReason}
                        value={reasons[approval.id] ?? ''}
                        onChange={(event) => setReasons((current) => ({ ...current, [approval.id]: event.target.value }))}
                      />
                      <Button variant="outline" disabled={busyId === approval.id} onClick={() => void decide(approval.id, 'reject')}>
                        {a.reject}
                      </Button>
                      <Button disabled={busyId === approval.id} onClick={() => void decide(approval.id, 'approve')}>
                        {a.approve}
                      </Button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
