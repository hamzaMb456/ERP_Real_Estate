'use client';

import { useState } from 'react';
import { BranchDialog, type BranchRow } from '@/components/domain/branch-dialog';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { useT } from '@/i18n/provider';
import { useCanManage } from '@/lib/use-can-edit';
import { useGraphql } from '@/lib/use-graphql';

type BranchesAdmin = { branches: BranchRow[] };

const BRANCHES_ADMIN_QUERY = `
  query BranchesAdmin {
    branches { id name slug city region address phone }
  }
`;

/** « Agences »: agencies with their public addresses. Only the manager or org_admin changes them. */
export default function AgenciesPage() {
  const t = useT();
  const f = t.properties.branchForm;
  const canManage = useCanManage();
  const [reload, setReload] = useState(0);
  const refresh = () => setReload((value) => value + 1);
  const result = useGraphql<BranchesAdmin>(BRANCHES_ADMIN_QUERY, undefined, reload);

  if (!canManage) {
    return <p className="text-sm text-muted-foreground">{f.forbidden}</p>;
  }

  const data = result.status === 'success' ? result.data : null;

  return (
    <div className="space-y-8">
      <PageHeader title={f.agenciesTitle} description={f.agenciesIntro} />

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
    </div>
  );
}
