'use client';

import { useState } from 'react';
import { BranchDialog, type BranchRow } from '@/components/domain/branch-dialog';
import { StaffActions } from '@/components/domain/staff-actions';
import { StaffActivity, type ActivityRow } from '@/components/domain/staff-activity';
import { StaffBranchesDialog, type StaffRow } from '@/components/domain/staff-branches-dialog';
import { StaffCreateDialog } from '@/components/domain/staff-create-dialog';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { useT } from '@/i18n/provider';
import { useCanManage } from '@/lib/use-can-edit';
import { useGraphql } from '@/lib/use-graphql';

type BranchesAdmin = { branches: BranchRow[]; staff: StaffRow[] };

const BRANCHES_ADMIN_QUERY = `
  query BranchesAdmin {
    branches { id name slug city region address phone }
    staff { user_id display_name email branch_ids status }
  }
`;

const STAFF_ACTIVITY_QUERY = `
  query StaffActivityList {
    staff_activity { id user_id kind actor_user_id created_at detail }
  }
`;

/** « Agences et équipes régionales »: agencies with their public addresses, regional staff with their agencies, and the trail. */
export default function AgenciesPage() {
  const t = useT();
  const f = t.properties.branchForm;
  const a = t.leases.approvals;
  const canManage = useCanManage();
  const [reload, setReload] = useState(0);
  const refresh = () => setReload((value) => value + 1);
  const result = useGraphql<BranchesAdmin>(BRANCHES_ADMIN_QUERY, undefined, reload);
  const activity = useGraphql<{ staff_activity: ActivityRow[] }>(STAFF_ACTIVITY_QUERY, undefined, reload);

  if (!canManage) {
    return <p className="text-sm text-muted-foreground">{a.forbidden}</p>;
  }

  const data = result.status === 'success' ? result.data : null;
  const branchName = (id: string) => data?.branches.find((b) => b.id === id)?.name ?? id;
  const names = Object.fromEntries((data?.staff ?? []).map((member) => [member.user_id, member.display_name]));

  return (
    <div className="space-y-8">
      <PageHeader title={f.staffTitle} description={f.staffIntro} />

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-base font-medium">{f.branches}</h2>
          <BranchDialog trigger={<Button size="sm">{f.newBranch}</Button>} onSaved={refresh} />
        </div>
        {data && data.branches.length === 0 && <p className="text-sm text-muted-foreground">{f.noBranches}</p>}
        {data && data.branches.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {data.branches.map((branch) => (
              <li key={branch.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
                <div className="space-y-0.5">
                  <p className="font-medium">{branch.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {[branch.city, branch.region].filter(Boolean).join(' · ')}
                    {branch.slug ? ` · /agences/${branch.slug}` : ''}
                  </p>
                </div>
                <BranchDialog branch={branch} trigger={<Button variant="outline" size="sm">{f.edit}</Button>} onSaved={refresh} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-base font-medium">{f.staff}</h2>
          {data && <StaffCreateDialog branches={data.branches} trigger={<Button size="sm">{f.newStaff}</Button>} onSaved={refresh} />}
        </div>
        {data && data.staff.length === 0 && <p className="text-sm text-muted-foreground">{f.noStaff}</p>}
        {data && data.staff.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {data.staff.map((member) => (
              <li key={member.user_id} className="flex flex-wrap items-center justify-between gap-4 p-4">
                <div className="space-y-0.5">
                  <p className="font-medium">
                    {member.display_name}
                    <span className="ms-2 rounded-full border px-2 py-0.5 text-xs font-normal text-muted-foreground">{f.status[member.status]}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {member.branch_ids.length > 0 ? member.branch_ids.map(branchName).join(', ') : f.noBranches}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {member.status !== 'disabled' && (
                    <StaffBranchesDialog member={member} branches={data.branches} trigger={<Button variant="outline" size="sm">{f.edit}</Button>} onSaved={refresh} />
                  )}
                  <StaffActions member={member} onDone={refresh} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-medium">{f.activityTitle}</h2>
        {activity.status === 'success' && <StaffActivity rows={activity.data.staff_activity} names={names} />}
      </section>
    </div>
  );
}
