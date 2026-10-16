'use client';

import { useState } from 'react';
import { Download, ExternalLink, FileText, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { FieldLabelWithHelp } from '@/components/field-help';
import { FileDrop } from '@/components/files/file-drop';
import { Pulse } from '@/components/motion/primitives';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toUserMessage } from '@/lib/errors';
import { validateFile } from '@/lib/files';
import { uploadLeaseDocument } from '@/lib/lease-files';
import { type LeaseDocumentCategory } from '@/lib/leases';
import { formatDate } from '@/lib/ownership';
import { deleteStoredFile, downloadStoredFile, leaseStorageDeps, presignedUrl } from '@/lib/storage';
import { showError } from '@/lib/show-error';
import { useCanEdit } from '@/lib/use-can-edit';
import { useGraphql } from '@/lib/use-graphql';

import { useT } from '@/i18n/provider';
const DOCUMENTS_QUERY = `
  query LeaseDocuments($id: uuid!) {
    lease_files(where: { lease_id: { _eq: $id } }, order_by: [{ created_at: desc }]) { id storage_file_id title category created_at }
  }
`;

type Doc = { id: string; storage_file_id: string; title: string; category: LeaseDocumentCategory | string; created_at: string };

export function LeaseDocuments({ leaseId }: { leaseId: string }) {
  const t = useT();
  const canEdit = useCanEdit();
  const [reload, setReload] = useState(0);
  const [category, setCategory] = useState<LeaseDocumentCategory>('signed_lease');
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState<Doc | null>(null);
  const result = useGraphql<{ lease_files: Doc[] }>(DOCUMENTS_QUERY, { id: leaseId }, reload);
  const refresh = () => setReload((value) => value + 1);

  async function handle(files: File[]) {
    setBusy(true);
    let uploaded = 0;
    for (const file of files) {
      const invalid = validateFile(file, 'document');
      if (invalid) {
        toast.error(t.leases.documents.rejected, { description: invalid });
        continue;
      }
      try {
        await uploadLeaseDocument(file, leaseId, category, leaseStorageDeps);
        uploaded += 1;
      } catch (error) {
        showError(t.leases.documents.sendFailed, error);
      }
    }
    setBusy(false);
    if (uploaded > 0) {
      toast.success(uploaded > 1 ? t.leases.documents.addedMany(uploaded) : t.leases.documents.addedOne);
      refresh();
    }
  }

  async function openDocument(doc: Doc) {
    // Open the tab during the click, then point it at the signed link (avoids popup blockers).
    const tab = window.open('', '_blank');
    try {
      const url = await presignedUrl(doc.storage_file_id);
      if (tab) {
        tab.opener = null;
        tab.location.href = url;
      }
    } catch (error) {
      tab?.close();
      showError(t.files.documents.openFailed, error);
    }
  }

  if (result.status === 'loading') return <Pulse className="text-sm text-muted-foreground">{t.files.documents.loading}</Pulse>;
  if (result.status === 'error') return <p role="alert" className="text-sm text-destructive">{t.files.documents.loadError(result.message)}</p>;
  const docs = result.data.lease_files;

  return (
    <div className="space-y-6">
      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t.files.documents.addTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field className="max-w-xs">
              <FieldLabelWithHelp htmlFor="lease-document-category" help={t.leases.documents.categoryHelp}>
                {t.files.documents.category}
              </FieldLabelWithHelp>
              <Select value={category} onValueChange={(value) => setCategory(value as LeaseDocumentCategory)}>
                <SelectTrigger id="lease-document-category" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(t.leases.documentCategories).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <FileDrop kind="document" disabled={busy} onFiles={(files) => void handle(files)} />
          </CardContent>
        </Card>
      )}

      {docs.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
          <FileText className="size-6" aria-hidden />
          {t.files.documents.empty}
        </div>
      ) : (
        (Object.keys(t.leases.documentCategories) as LeaseDocumentCategory[])
          .filter((key) => docs.some((doc) => doc.category === key))
          .map((key) => (
            <Card key={key} className="gap-0 py-0">
              <CardHeader className="border-b py-3">
                <CardTitle className="text-sm">{t.leases.documentCategories[key]}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y">
                  {docs
                    .filter((doc) => doc.category === key)
                    .map((doc) => (
                      <li key={doc.id} className="flex items-center justify-between gap-3 px-4 py-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                          <span className="truncate text-sm font-medium">{doc.title}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">{formatDate(doc.created_at.slice(0, 10))}</span>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <Button variant="ghost" size="icon-sm" aria-label={t.files.documents.open(doc.title)} onClick={() => void openDocument(doc)}>
                            <ExternalLink />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={t.files.documents.download(doc.title)}
                            onClick={() => void downloadStoredFile(doc.storage_file_id, doc.title).catch((error) => showError(t.files.documents.downloadFailed, error))}
                          >
                            <Download />
                          </Button>
                          {canEdit && (
                            <Button variant="ghost" size="icon-sm" aria-label={t.files.documents.delete(doc.title)} onClick={() => setToDelete(doc)}>
                              <Trash2 />
                            </Button>
                          )}
                        </div>
                      </li>
                    ))}
                </ul>
              </CardContent>
            </Card>
          ))
      )}

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={t.files.documents.deleteTitle}
        description={toDelete ? t.files.documents.deleteBody(toDelete.title) : ''}
        onConfirm={async () => {
          if (!toDelete) return;
          try {
            await deleteStoredFile(toDelete.storage_file_id);
            toast.success(t.files.documents.deleted);
            refresh();
          } catch (error) {
            toast.error(t.files.documents.deleteFailed, { description: toUserMessage(error) });
          }
        }}
      />
    </div>
  );
}
