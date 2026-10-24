'use client';

import { useState } from 'react';
import { CheckCircle2, CircleAlert, ExternalLink, Eye, ImageIcon, Loader2, Pencil } from '@/components/icons';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { toUserMessage } from '@/lib/errors';
import { graphql } from '@/lib/graphql';
import { cn } from '@/lib/utils';
import { websiteBlockers, type WebsiteBlocker, type WebsiteInput } from '@/lib/website';

import { useT } from '@/i18n/provider';

const SET_VISIBILITY = `
  mutation SetUnitVisibility($id: uuid!, $show: Boolean!) {
    update_units_by_pk(pk_columns: { id: $id }, _set: { show_on_website: $show }) { id }
  }
`;

type Props = {
  unit: WebsiteInput & { id: string };
  canEdit: boolean;
  onChanged: () => void;
  /** Opens the unit form (price, status fields). */
  onEdit: () => void;
  /** Goes to the unit's Photos tab. */
  onAddPhotos: () => void;
};

/**
 * « Site web » card of the unit page. There is nothing to publish: the unit goes online by itself once every condition
 * holds, and this card lists the ones that do not, each with the way to fix it.
 */
export function WebsiteCard({ unit, canEdit, onChanged, onEdit, onAddPhotos }: Props) {
  const t = useT();
  const [saving, setSaving] = useState(false);
  const blockers = websiteBlockers(unit);
  const live = blockers.length === 0;
  const text = t.listings.website;

  async function setVisible(show: boolean) {
    setSaving(true);
    try {
      await graphql(SET_VISIBILITY, { id: unit.id, show });
      toast.success(show ? text.shownToast : text.hiddenToast);
      onChanged();
    } catch (error) {
      toast.error(text.toggleFailed, { description: toUserMessage(error) });
    } finally {
      setSaving(false);
    }
  }

  const fix: Partial<Record<WebsiteBlocker, { label: string; icon: typeof Pencil; run: () => void }>> = {
    hidden: { label: text.show, icon: Eye, run: () => void setVisible(true) },
    no_rent: { label: text.editUnit, icon: Pencil, run: onEdit },
    no_sale_price: { label: text.editUnit, icon: Pencil, run: onEdit },
    no_photo: { label: text.addPhotos, icon: ImageIcon, run: onAddPhotos },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          {text.title}
          <Badge variant="secondary" className={cn('h-6 gap-1.5 px-2.5', live ? 'bg-success/12 text-success' : 'bg-muted text-muted-foreground')}>
            <span className="size-1.5 rounded-full bg-current" aria-hidden />
            {live ? text.live : text.offline}
          </Badge>
        </CardTitle>
        <CardDescription>{text.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {live ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-success" aria-hidden />
              {text.liveBody}
            </p>
            <Button asChild variant="outline" size="sm">
              <a href={'/logement/' + unit.id} target="_blank" rel="noopener noreferrer">
                <ExternalLink data-icon="inline-start" className="rtl:-scale-x-100" />
                {text.viewOnSite}
              </a>
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-muted-foreground">{text.offlineBody}</p>
            <ul className="space-y-2">
              {blockers.map((blocker) => {
                const action = fix[blocker];
                return (
                  <li key={blocker} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                    <span className="flex min-w-0 items-start gap-2">
                      <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                      {text.blockers[blocker]}
                    </span>
                    {canEdit && action && (
                      <Button variant="outline" size="sm" disabled={saving} onClick={action.run}>
                        <action.icon data-icon="inline-start" />
                        {action.label}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {canEdit && (
          <label className="flex cursor-pointer items-start gap-2">
            <Checkbox className="mt-0.5" checked={unit.show_on_website} disabled={saving} onCheckedChange={(checked) => void setVisible(checked === true)} />
            <span className="space-y-0.5">
              <span className="flex items-center gap-1.5 font-medium">
                {text.visibility}
                {saving && <Loader2 className="size-3.5" aria-hidden />}
              </span>
              <span className="block text-xs text-muted-foreground">{text.visibilityHelp}</span>
            </span>
          </label>
        )}
      </CardContent>
    </Card>
  );
}
