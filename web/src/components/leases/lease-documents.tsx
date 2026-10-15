'use client';

import { useState } from 'react';
import { Download, ExternalLink, FileText, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { FileDrop } from '@/components/files/file-drop';
import { Pulse } from '@/components/motion/primitives';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toFrenchError } from '@/lib/errors';
import { validateFile } from '@/lib/files';
import { uploadLeaseDocument } from '@/lib/lease-files';
import { LEASE_DOCUMENT_CATEGORIES, type LeaseDocumentCategory } from '@/lib/leases';
import { formatDateFr } from '@/lib/ownership';
import { deleteStoredFile, downloadStoredFile, leaseStorageDeps, presignedUrl } from '@/lib/storage';
import { showError } from '@/lib/show-error';
import { useCanEdit } from '@/lib/use-can-edit';
import { useGraphql } from '@/lib/use-graphql';

const DOCUMENTS_QUERY = `
  query LeaseDocuments($id: uuid!) {
    lease_files(where: { lease_id: { _eq: $id } }, order_by: [{ created_at: desc }]) { id storage_file_id title category created_at }
  }
`;

type Doc = { id: string; storage_file_id: string; title: string; category: LeaseDocumentCategory | string; created_at: string };

export function LeaseDocuments({ leaseId }: { leaseId: string }) {
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
        toast.error('Fichier refusé', { description: invalid });
        continue;
      }
      try {
        await uploadLeaseDocument(file, leaseId, category, leaseStorageDeps);
        uploaded += 1;
      } catch (error) {
        showError('Envoi impossible', error);
      }
    }
    setBusy(false);
    if (uploaded > 0) {
      toast.success(uploaded > 1 ? `${uploaded} documents ajoutés` : 'Document ajouté');
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
      showError('Ouverture impossible', error);
    }
  }

  if (result.status === 'loading') return <Pulse className="text-sm text-muted-foreground">Chargement des documents…</Pulse>;
  if (result.status === 'error') return <p role="alert" className="text-sm text-destructive">Impossible de charger les documents : {result.message}</p>;
  const docs = result.data.lease_files;

  return (
    <div className="space-y-6">
      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ajouter des documents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field className="max-w-xs">
              <FieldLabel htmlFor="lease-document-category">Catégorie</FieldLabel>
              <Select value={category} onValueChange={(value) => setCategory(value as LeaseDocumentCategory)}>
                <SelectTrigger id="lease-document-category" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(LEASE_DOCUMENT_CATEGORIES).map(([value, label]) => (
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
          Aucun document pour le moment.
        </div>
      ) : (
        (Object.keys(LEASE_DOCUMENT_CATEGORIES) as LeaseDocumentCategory[])
          .filter((key) => docs.some((doc) => doc.category === key))
          .map((key) => (
            <Card key={key} className="gap-0 py-0">
              <CardHeader className="border-b py-3">
                <CardTitle className="text-sm">{LEASE_DOCUMENT_CATEGORIES[key]}</CardTitle>
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
                          <span className="shrink-0 text-xs text-muted-foreground">{formatDateFr(doc.created_at.slice(0, 10))}</span>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <Button variant="ghost" size="icon-sm" aria-label={'Ouvrir ' + doc.title} onClick={() => void openDocument(doc)}>
                            <ExternalLink />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={'Télécharger ' + doc.title}
                            onClick={() => void downloadStoredFile(doc.storage_file_id, doc.title).catch((error) => showError('Téléchargement impossible', error))}
                          >
                            <Download />
                          </Button>
                          {canEdit && (
                            <Button variant="ghost" size="icon-sm" aria-label={'Supprimer ' + doc.title} onClick={() => setToDelete(doc)}>
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
        title="Supprimer ce document ?"
        description={toDelete ? `« ${toDelete.title} » sera supprimé définitivement.` : ''}
        onConfirm={async () => {
          if (!toDelete) return;
          try {
            await deleteStoredFile(toDelete.storage_file_id);
            toast.success('Document supprimé');
            refresh();
          } catch (error) {
            toast.error('Suppression impossible', { description: toFrenchError(error) });
          }
        }}
      />
    </div>
  );
}
