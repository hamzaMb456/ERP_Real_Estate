'use client';

import { useState, type FormEvent } from 'react';
import { Loader2, Pencil, Plus, Trash2 } from '@/components/icons';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { FieldLabelWithHelp } from '@/components/field-help';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toUserMessage } from '@/lib/errors';
import { graphql } from '@/lib/graphql';

import { useT } from '@/i18n/provider';
const ADD_AREA = `mutation AddArea($object: common_areas_insert_input!) { insert_common_areas_one(object: $object) { id } }`;
const UPDATE_AREA = `mutation UpdateArea($id: uuid!, $set: common_areas_set_input!) { update_common_areas_by_pk(pk_columns: { id: $id }, _set: $set) { id } }`;
const DELETE_AREA = `mutation DeleteArea($id: uuid!) { delete_common_areas_by_pk(id: $id) { id } }`;

export type CommonArea = { id: string; name: string; kind: string; notes: string | null };

type Editing = { mode: 'create' } | { mode: 'edit'; area: CommonArea } | null;

export function CommonAreasList({
  propertyId,
  areas,
  canEdit,
  onChanged,
}: {
  propertyId: string;
  areas: CommonArea[];
  canEdit: boolean;
  onChanged: () => void;
}) {
  const t = useT();
  const [editing, setEditing] = useState<Editing>(null);
  const [toDelete, setToDelete] = useState<CommonArea | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t.files.areas.title}</CardTitle>
        <CardDescription>{t.files.areas.description}</CardDescription>
        {canEdit && (
          <CardAction>
            <Button size="sm" onClick={() => setEditing({ mode: 'create' })}>
              <Plus data-icon="inline-start" />
              {t.files.areas.add}
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {areas.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.files.areas.empty}</p>
        ) : (
          <ul className="divide-y">
            {areas.map((area) => (
              <li key={area.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0 text-sm">
                  <p className="font-medium">{area.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.labels.areaKinds[area.kind] ?? area.kind}
                    {area.notes ? ' · ' + area.notes : ''}
                  </p>
                </div>
                {canEdit && (
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="icon-sm" aria-label={t.files.areas.edit(area.name)} onClick={() => setEditing({ mode: 'edit', area })}>
                      <Pencil />
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label={t.files.areas.delete(area.name)} onClick={() => setToDelete(area)}>
                      <Trash2 />
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing?.mode === 'edit' ? t.files.areas.editTitle : t.files.areas.addTitle}</DialogTitle>
            <DialogDescription>{t.files.areas.dialogDescription}</DialogDescription>
          </DialogHeader>
          {editing && (
            <AreaForm
              propertyId={propertyId}
              area={editing.mode === 'edit' ? editing.area : undefined}
              onCancel={() => setEditing(null)}
              onSaved={() => {
                setEditing(null);
                onChanged();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={t.files.areas.deleteTitle}
        description={toDelete ? t.files.areas.deleteBody(toDelete.name) : ''}
        onConfirm={async () => {
          if (!toDelete) return;
          try {
            await graphql(DELETE_AREA, { id: toDelete.id });
            toast.success(t.files.areas.deleted);
            onChanged();
          } catch (error) {
            toast.error(t.files.areas.deleteFailed, { description: toUserMessage(error) });
          }
        }}
      />
    </Card>
  );
}

function AreaForm({
  propertyId,
  area,
  onCancel,
  onSaved,
}: {
  propertyId: string;
  area?: CommonArea;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const t = useT();
  const [name, setName] = useState(area?.name ?? '');
  const [kind, setKind] = useState(area?.kind ?? 'stairs');
  const [notes, setNotes] = useState(area?.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (name.trim().length === 0) return setError(t.files.areas.nameRequired);
    setError(null);
    setSaving(true);
    const fields = { name: name.trim(), kind, notes: notes.trim() === '' ? null : notes.trim() };
    try {
      if (area) await graphql(UPDATE_AREA, { id: area.id, set: fields });
      else await graphql(ADD_AREA, { object: { ...fields, property_id: propertyId } });
      toast.success(area ? t.files.areas.updated : t.files.areas.added);
      onSaved();
    } catch (caught) {
      setError(toUserMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <Field data-invalid={error !== null && name.trim() === ''}>
        <FieldLabelWithHelp htmlFor="area-name" help={t.files.areas.nameHelp}>
          {t.files.areas.name}
        </FieldLabelWithHelp>
        <Input id="area-name" value={name} placeholder={t.files.areas.namePlaceholder} onChange={(event) => setName(event.target.value)} />
      </Field>
      <Field>
        <FieldLabelWithHelp htmlFor="area-kind" help={t.files.areas.typeHelp}>
          {t.files.areas.type}
        </FieldLabelWithHelp>
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger id="area-kind" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(t.labels.areaKinds).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabelWithHelp htmlFor="area-notes" help={t.files.areas.notesHelp}>
          {t.files.areas.notes}
        </FieldLabelWithHelp>
        <Textarea id="area-notes" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
      </Field>
      {error && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t.common.cancel}
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 data-icon="inline-start" />}
          {t.common.save}
        </Button>
      </DialogFooter>
    </form>
  );
}
