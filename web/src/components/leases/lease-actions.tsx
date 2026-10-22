'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Archive, ArchiveRestore, CalendarSync, DoorOpen, FileCheck, Loader2, Pencil } from '@/components/icons';
import { toast } from 'sonner';
import type { LeaseDetails } from '@/components/leases/lease-details';
import { ActivateDialog, EndDialog, RenewDialog } from '@/components/leases/lease-dialogs';
import { Button } from '@/components/ui/button';
import { graphql } from '@/lib/graphql';
import { showError } from '@/lib/show-error';
import { useCanEdit } from '@/lib/use-can-edit';

import { useT } from '@/i18n/provider';
const SET_ARCHIVED = `
  mutation SetLeaseArchived($id: uuid!, $archived_at: timestamptz) {
    update_leases_by_pk(pk_columns: { id: $id }, _set: { archived_at: $archived_at }) { id }
  }
`;

type Props = { lease: LeaseDetails; onChanged: () => void };

export function LeaseActions({ lease, onChanged }: Props) {
  const t = useT();
  const canEdit = useCanEdit();
  const [archiving, setArchiving] = useState(false);
  if (!canEdit) return null;

  async function toggleArchive() {
    setArchiving(true);
    try {
      await graphql(SET_ARCHIVED, { id: lease.id, archived_at: lease.archived_at ? null : new Date().toISOString() });
      toast.success(lease.archived_at ? t.leases.actions.draftRestored : t.leases.actions.draftArchived);
      onChanged();
    } catch (error) {
      showError(t.leases.actions.actionFailed, error, () => void toggleArchive());
    } finally {
      setArchiving(false);
    }
  }

  if (lease.status === 'draft') {
    const archived = lease.archived_at !== null;
    return (
      <>
        {!archived && (
          <>
            <Button asChild variant="outline">
              <Link href={'/baux/' + lease.id + '/modifier'}>
                <Pencil data-icon="inline-start" />
                {t.common.edit}
              </Link>
            </Button>
            <ActivateDialog
              leaseId={lease.id}
              onDone={onChanged}
              trigger={
                <Button>
                  <FileCheck data-icon="inline-start" />
                  {t.leases.actions.activate}
                </Button>
              }
            />
          </>
        )}
        <Button variant="outline" onClick={() => void toggleArchive()} disabled={archiving}>
          {archiving ? <Loader2 data-icon="inline-start" /> : archived ? <ArchiveRestore data-icon="inline-start" /> : <Archive data-icon="inline-start" />}
          {archived ? t.leases.actions.restore : t.leases.actions.archive}
        </Button>
      </>
    );
  }

  if (lease.status === 'active') {
    return (
      <>
        <RenewDialog
          lease={lease}
          onDone={onChanged}
          trigger={
            <Button>
              <CalendarSync data-icon="inline-start" />
              {t.leases.actions.renew}
            </Button>
          }
        />
        <EndDialog
          lease={lease}
          onDone={onChanged}
          trigger={
            <Button variant="outline">
              <DoorOpen data-icon="inline-start" />
              {t.leases.actions.end}
            </Button>
          }
        />
      </>
    );
  }

  return null;
}
