'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, ImageIcon, Star, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { FileUploader } from '@/components/files/file-uploader';
import { PhotoViewer } from '@/components/files/photo-viewer';
import { StorageImage } from '@/components/files/storage-image';
import { Pulse } from '@/components/motion/primitives';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toFrenchError } from '@/lib/errors';
import { graphql } from '@/lib/graphql';
import { deleteStoredFile } from '@/lib/storage';
import { fileTargetWhere, type FileTarget } from '@/lib/upload';
import { useCanEdit } from '@/lib/use-can-edit';
import { useGraphql } from '@/lib/use-graphql';

const PHOTOS_QUERY = `
  query Photos($where: property_files_bool_exp!) {
    property_files(where: $where, order_by: [{ sort_order: asc }, { created_at: asc }]) {
      id storage_file_id title is_cover sort_order
    }
  }
`;

const SET_COVER = `
  mutation SetCover($others: property_files_bool_exp!, $id: uuid!) {
    update_property_files(where: $others, _set: { is_cover: false }) { affected_rows }
    update_property_files_by_pk(pk_columns: { id: $id }, _set: { is_cover: true }) { id }
  }
`;

const SWAP_ORDER = `
  mutation SwapOrder($a: uuid!, $aOrder: Int!, $b: uuid!, $bOrder: Int!) {
    first: update_property_files_by_pk(pk_columns: { id: $a }, _set: { sort_order: $aOrder }) { id }
    second: update_property_files_by_pk(pk_columns: { id: $b }, _set: { sort_order: $bOrder }) { id }
  }
`;

type Photo = { id: string; storage_file_id: string; title: string; is_cover: boolean; sort_order: number };

export function PhotoGallery({ target }: { target: FileTarget }) {
  const canEdit = useCanEdit();
  const [reload, setReload] = useState(0);
  const [viewer, setViewer] = useState<number | null>(null);
  const [toDelete, setToDelete] = useState<Photo | null>(null);
  const where = fileTargetWhere(target, 'photo');
  const result = useGraphql<{ property_files: Photo[] }>(PHOTOS_QUERY, { where }, reload);
  const refresh = () => setReload((value) => value + 1);

  async function run(action: () => Promise<unknown>, success: string) {
    try {
      await action();
      toast.success(success);
      refresh();
    } catch (error) {
      toast.error('Action impossible', { description: toFrenchError(error) });
    }
  }

  if (result.status === 'loading') return <Pulse className="text-sm text-muted-foreground">Chargement des photos…</Pulse>;
  if (result.status === 'error') return <p role="alert" className="text-sm text-destructive">Impossible de charger les photos : {result.message}</p>;
  const photos = result.data.property_files;

  return (
    <div className="space-y-4">
      {canEdit && <FileUploader target={target} kind="photo" nextSortOrder={photos.length} onUploaded={refresh} />}
      {photos.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
          <ImageIcon className="size-6" aria-hidden />
          Aucune photo pour le moment.
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((photo, index) => (
            <li key={photo.id} className="group relative overflow-hidden rounded-lg border bg-card">
              <button type="button" onClick={() => setViewer(index)} className="block aspect-[4/3] w-full" aria-label={'Agrandir ' + photo.title}>
                <StorageImage fileId={photo.storage_file_id} width={480} alt={photo.title} className="size-full object-cover" />
              </button>
              {photo.is_cover && <Badge className="absolute left-2 top-2">Couverture</Badge>}
              <div className="flex items-center justify-between gap-1 border-t px-2 py-1">
                <span className="truncate text-xs">{photo.title}</span>
                {canEdit && (
                  <div className="flex shrink-0">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={'Utiliser ' + photo.title + ' comme couverture'}
                      disabled={photo.is_cover}
                      onClick={() =>
                        void run(() => graphql(SET_COVER, { others: { ...where, is_cover: { _eq: true } }, id: photo.id }), 'Photo de couverture définie')
                      }
                    >
                      <Star />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={'Déplacer ' + photo.title + ' vers la gauche'}
                      disabled={index === 0}
                      onClick={() =>
                        void run(
                          () => graphql(SWAP_ORDER, { a: photo.id, aOrder: index - 1, b: photos[index - 1].id, bOrder: index }),
                          'Ordre mis à jour',
                        )
                      }
                    >
                      <ChevronLeft />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={'Déplacer ' + photo.title + ' vers la droite'}
                      disabled={index === photos.length - 1}
                      onClick={() =>
                        void run(
                          () => graphql(SWAP_ORDER, { a: photo.id, aOrder: index + 1, b: photos[index + 1].id, bOrder: index }),
                          'Ordre mis à jour',
                        )
                      }
                    >
                      <ChevronRight />
                    </Button>
                    <Button variant="ghost" size="icon-xs" aria-label={'Supprimer ' + photo.title} onClick={() => setToDelete(photo)}>
                      <Trash2 />
                    </Button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <PhotoViewer photos={photos} index={viewer} onIndexChange={setViewer} />
      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Supprimer cette photo ?"
        description={toDelete ? `« ${toDelete.title} » sera supprimée définitivement.` : ''}
        onConfirm={async () => {
          if (toDelete) await run(() => deleteStoredFile(toDelete.storage_file_id), 'Photo supprimée');
        }}
      />
    </div>
  );
}
