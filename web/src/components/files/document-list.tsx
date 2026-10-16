'use client';

import { useState } from 'react';
import { Download, ExternalLink, FileText, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { FieldLabelWithHelp } from '@/components/field-help';
import { FileUploader } from '@/components/files/file-uploader';
import { Pulse } from '@/components/motion/primitives';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toUserMessage } from '@/lib/errors';
import { type DocumentCategory } from '@/lib/files';
import { deleteStoredFile, downloadStoredFile, presignedUrl } from '@/lib/storage';
import { fileTargetWhere, type FileTarget } from '@/lib/upload';
import { useCanEdit } from '@/lib/use-can-edit';
import { useGraphql } from '@/lib/use-graphql';

import { getIntlLocale } from '@/i18n/store';
import { useT } from '@/i18n/provider';
const DOCUMENTS_QUERY = `
  query Documents($where: property_files_bool_exp!) {
    property_files(where: $where, order_by: [{ created_at: desc }]) { id storage_file_id title category created_at }
  }
`;

type Doc = { id: string; storage_file_id: string; title: string; category: DocumentCategory; created_at: string };

const shortDate = (iso: string) => new Intl.DateTimeFormat(getIntlLocale(), { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso));

export function DocumentList({ target }: { target: FileTarget }) {
  const t = useT();
  const canEdit = useCanEdit();
  const [reload, setReload] = useState(0);
  const [category, setCategory] = useState<DocumentCategory>('title_deed');
  const [toDelete, setToDelete] = useState<Doc | null>(null);
  const result = useGraphql<{ property_files: Doc[] }>(DOCUMENTS_QUERY, { where: fileTargetWhere(target, 'document') }, reload);
  const refresh = () => setReload((value) => value + 1);

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
      toast.error(t.files.documents.openFailed, { description: toUserMessage(error) });
    }
  }

  async function download(doc: Doc) {
    try {
      await downloadStoredFile(doc.storage_file_id, doc.title);
    } catch (error) {
      toast.error(t.files.documents.downloadFailed, { description: toUserMessage(error) });
    }
  }

  if (result.status === 'loading') return <Pulse className="text-sm text-muted-foreground">{t.files.documents.loading}</Pulse>;
  if (result.status === 'error') return <p role="alert" className="text-sm text-destructive">{t.files.documents.loadError(result.message)}</p>;
  const docs = result.data.property_files;

  return (
    <div className="space-y-6">
      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t.files.documents.addTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field className="max-w-xs">
              <FieldLabelWithHelp htmlFor="document-category" help={t.files.documents.categoryHelp}>
                {t.files.documents.category}
              </FieldLabelWithHelp>
              <Select value={category} onValueChange={(value) => setCategory(value as DocumentCategory)}>
                <SelectTrigger id="document-category" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(t.files.categories).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <FileUploader target={target} kind="document" category={category} nextSortOrder={docs.length} onUploaded={refresh} />
          </CardContent>
        </Card>
      )}

      {docs.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
          <FileText className="size-6" aria-hidden />
          {t.files.documents.empty}
        </div>
      ) : (
        (Object.keys(t.files.categories) as DocumentCategory[])
          .filter((key) => docs.some((doc) => doc.category === key))
          .map((key) => (
            <Card key={key} className="gap-0 py-0">
              <CardHeader className="border-b py-3">
                <CardTitle className="text-sm">{t.files.categories[key]}</CardTitle>
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
                          <span className="shrink-0 text-xs text-muted-foreground">{shortDate(doc.created_at)}</span>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <Button variant="ghost" size="icon-sm" aria-label={t.files.documents.open(doc.title)} onClick={() => void openDocument(doc)}>
                            <ExternalLink />
                          </Button>
                          <Button variant="ghost" size="icon-sm" aria-label={t.files.documents.download(doc.title)} onClick={() => void download(doc)}>
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
