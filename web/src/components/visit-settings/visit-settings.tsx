'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Check } from '@/components/icons';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useT } from '@/i18n/provider';
import { graphql } from '@/lib/graphql';
import { useGraphql } from '@/lib/use-graphql';
import { toUserMessage } from '@/lib/errors';

const GET_SETTINGS = `query VisitPaymentMethod { organizations { id visit_payment_method } }`;
const SET_SETTINGS = `mutation SetVisitPaymentMethod($id: uuid!, $value: String) {
  update_organizations_by_pk(pk_columns: { id: $id }, _set: { visit_payment_method: $value }) { id }
}`;

type OrgRow = { id: string; visit_payment_method: string | null };

/** 'none' stands for the database's null (free, no payment method chosen): the Select needs a non-empty value. */
type MethodValue = 'virtual' | 'manual' | 'none';

function toValue(method: string | null): MethodValue {
  return method === 'virtual' || method === 'manual' ? method : 'none';
}

/** Admin setting (administration > Visites): organizations.visit_payment_method (migration 0011). */
export function VisitSettings() {
  const t = useT().visitSettings;
  const [reloadKey, setReloadKey] = useState(0);
  const state = useGraphql<{ organizations: OrgRow[] }>(GET_SETTINGS, undefined, reloadKey);
  // The user's pending pick, unset once it is saved (then the refetched org value takes over again).
  const [override, setOverride] = useState<MethodValue | null>(null);
  const [saving, setSaving] = useState(false);

  const org = state.status === 'success' ? state.data.organizations[0] ?? null : null;
  const saved = org ? toValue(org.visit_payment_method) : null;
  const value = override ?? saved;
  const dirty = saved !== null && value !== saved;

  async function save() {
    if (!org || value === null) return;
    setSaving(true);
    try {
      await graphql(SET_SETTINGS, { id: org.id, value: value === 'none' ? null : value });
      toast.success(t.saved);
      setOverride(null);
      setReloadKey((key) => key + 1);
    } catch (error) {
      toast.error(t.saveFailed, { description: toUserMessage(error) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t.title} description={t.description} />

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>{t.methodLabel}</CardTitle>
          <CardDescription>{t.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={value ?? undefined} onValueChange={(next) => setOverride(next as MethodValue)} disabled={!org}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="virtual">{t.methods.virtual}</SelectItem>
              <SelectItem value="manual">{t.methods.manual}</SelectItem>
              <SelectItem value="none">{t.methods.none}</SelectItem>
            </SelectContent>
          </Select>

          <Button type="button" onClick={save} disabled={!dirty || saving}>
            <Check data-icon="inline-start" />
            {t.save}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
