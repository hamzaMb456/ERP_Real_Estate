'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Loader2, Mail, Phone } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatDate } from '@/lib/ownership';
import { requestUnitHeading, telLink, type RequestBase } from '@/lib/requests';
import { showError } from '@/lib/show-error';
import { cn } from '@/lib/utils';

import { useT } from '@/i18n/provider';

/**
 * Card of one visitor request, shared by « Demandes de location » and « Visites »: who asks (with call and write links),
 * about which unit, the specific details (a slot, a start date), the visitor's message, the staff's note and the actions.
 */
export function RequestCard({
  request,
  statusLabel,
  tone,
  details,
  actions,
  onSaveNote,
}: {
  request: RequestBase;
  statusLabel: string;
  tone: string;
  details: ReactNode;
  actions: ReactNode;
  onSaveNote: (note: string) => Promise<unknown>;
}) {
  const t = useT();
  const text = t.requests.card;
  const [note, setNote] = useState(request.staff_note ?? '');
  const [saving, setSaving] = useState(false);
  const dirty = note.trim() !== (request.staff_note ?? '').trim();

  const saveNote = async () => {
    setSaving(true);
    try {
      await onSaveNote(note);
      toast.success(text.noteSaved);
    } catch (error) {
      showError(text.updateFailed, error, () => void saveNote());
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="gap-4 p-4" data-scroll-item>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold">{request.full_name}</h2>
          <p className="text-xs text-muted-foreground">{text.received(formatDate(request.created_at.slice(0, 10)))}</p>
        </div>
        <Badge className={cn('h-6 px-2.5', tone)}>{statusLabel}</Badge>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <a href={telLink(request.phone)} dir="ltr">
            <Phone data-icon="inline-start" />
            {text.call(request.phone)}
          </a>
        </Button>
        {request.email && (
          <Button asChild variant="outline" size="sm">
            <a href={`mailto:${request.email}`} dir="ltr">
              <Mail data-icon="inline-start" />
              {text.email(request.email)}
            </a>
          </Button>
        )}
      </div>

      <div className="space-y-1 text-sm">
        <Link href={`/erp/biens/${request.unit.property.id}/unites/${request.unit.id}`} className="font-medium text-primary hover:underline">
          {requestUnitHeading(request.unit)}
        </Link>
        {details}
      </div>

      {request.message && (
        <blockquote className="rounded-lg bg-muted px-3 py-2 text-sm">
          <p className="mb-0.5 text-xs font-medium text-muted-foreground">{text.message}</p>
          <p className="whitespace-pre-wrap break-words">{request.message}</p>
        </blockquote>
      )}

      <div className="space-y-1.5">
        <Label htmlFor={`note-${request.id}`} className="text-xs text-muted-foreground">
          {text.note}
        </Label>
        <Textarea
          id={`note-${request.id}`}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={text.notePlaceholder}
          maxLength={2000}
        />
        {dirty && (
          <Button size="sm" variant="secondary" onClick={() => void saveNote()} disabled={saving}>
            {saving && <Loader2 data-icon="inline-start" />}
            {text.saveNote}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 border-t pt-3">{actions}</div>
    </Card>
  );
}
