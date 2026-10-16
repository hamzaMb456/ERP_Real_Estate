'use client';

import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { FieldHelp } from '@/components/field-help';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toUserMessage } from '@/lib/errors';
import { formatArea } from '@/lib/format';
import { graphql } from '@/lib/graphql';
import { SHARE_TOTAL, sharesTotal, suggestShares } from '@/lib/shares';
import { cn } from '@/lib/utils';

import { useT } from '@/i18n/provider';
const SAVE_SHARES = `
  mutation SaveShares($updates: [units_updates!]!) {
    update_units_many(updates: $updates) { affected_rows }
  }
`;

export type ShareUnit = { id: string; code: string; surface_m2: number | string | null; common_share: number | null };

type Parsed = number | null | 'invalid';

function parseShare(raw: string): Parsed {
  const text = raw.trim();
  if (text === '') return null;
  if (!/^\d+$/.test(text)) return 'invalid';
  const value = Number(text);
  return value <= SHARE_TOTAL ? value : 'invalid';
}

const asText = (value: number | null) => (value === null ? '' : String(value));

export function SharesTable({ units, canEdit, onSaved }: { units: ShareUnit[]; canEdit: boolean; onSaved: () => void }) {
  const t = useT();
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(units.map((unit) => [unit.id, asText(unit.common_share)])),
  );
  const [saving, setSaving] = useState(false);

  const parsed = units.map((unit) => parseShare(draft[unit.id] ?? ''));
  const invalid = parsed.some((value) => value === 'invalid');
  const total = sharesTotal(parsed.map((value) => (typeof value === 'number' ? value : null)));
  const complete = !invalid && total === SHARE_TOTAL;
  const dirty = units.some((unit) => (draft[unit.id] ?? '') !== asText(unit.common_share));

  function suggest() {
    const shares = suggestShares(units.map((unit) => ({ id: unit.id, surface: unit.surface_m2 })));
    setDraft(Object.fromEntries(units.map((unit) => [unit.id, String(shares[unit.id])])));
  }

  async function save() {
    setSaving(true);
    try {
      await graphql(SAVE_SHARES, {
        updates: units.map((unit, index) => {
          const value = parsed[index];
          return { where: { id: { _eq: unit.id } }, _set: { common_share: typeof value === 'number' ? value : null } };
        }),
      });
      toast.success(t.files.shares.saved);
      onSaved();
    } catch (error) {
      toast.error(t.files.shares.saveFailed, { description: toUserMessage(error) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="border-b bg-muted/30 py-4">
        <CardTitle className="text-base">{t.files.shares.title}</CardTitle>
        <CardDescription>{t.files.shares.description}</CardDescription>
        {canEdit && units.length > 0 && (
          <CardAction>
            <Button variant="outline" size="sm" onClick={suggest}>
              <Sparkles data-icon="inline-start" />
              {t.files.shares.suggest}
            </Button>
          </CardAction>
        )}
      </CardHeader>
      {units.length === 0 ? (
        <CardContent className="py-10 text-center text-sm text-muted-foreground">{t.files.shares.addUnitsFirst}</CardContent>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="ps-4">{t.files.shares.colUnit}</TableHead>
                <TableHead>{t.files.shares.colSurface}</TableHead>
                <TableHead className="w-40 pe-4 text-end">
                  <span className="inline-flex items-center justify-end gap-1.5">
                    {t.files.shares.colShares}
                    <FieldHelp>
                      {t.files.shares.help}
                    </FieldHelp>
                  </span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {units.map((unit, index) => (
                <TableRow key={unit.id}>
                  <TableCell className="ps-4 font-medium">{unit.code}</TableCell>
                  <TableCell className="tabular-nums">{formatArea(unit.surface_m2)}</TableCell>
                  <TableCell className="pe-4 text-end">
                    <Input
                      aria-label={t.files.shares.sharesOf(unit.code)}
                      inputMode="numeric"
                      className="ms-auto w-28 text-end tabular-nums"
                      value={draft[unit.id] ?? ''}
                      disabled={!canEdit}
                      aria-invalid={parsed[index] === 'invalid'}
                      onChange={(event) => setDraft((current) => ({ ...current, [unit.id]: event.target.value }))}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 border-t py-4">
            <div aria-live="polite" className="space-y-1">
              <p className={cn('text-sm font-semibold tabular-nums', complete ? 'text-success' : 'text-destructive')}>
                {t.files.shares.total(total, SHARE_TOTAL)}
              </p>
              {invalid && <p className="text-xs text-destructive">{t.files.shares.invalid}</p>}
            </div>
            {canEdit && (
              <Button onClick={() => void save()} disabled={saving || invalid || !dirty}>
                {saving && <Loader2 data-icon="inline-start" className="animate-spin" />}
                {t.files.shares.save}
              </Button>
            )}
          </CardContent>
        </>
      )}
    </Card>
  );
}
