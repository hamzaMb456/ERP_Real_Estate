'use client';

import { Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useT } from '@/i18n/provider';

const BARS = [64, 88, 46, 72, 30];

/** Real components on the live tokens: what changes in the palette changes here at once. */
export function PreviewPanel() {
  const t = useT().appearance.preview;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.heading}</CardTitle>
        <CardDescription>{t.cardBody}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm">
            {t.primaryButton}
          </Button>
          <Button type="button" size="sm" variant="outline">
            {t.secondaryButton}
          </Button>
        </div>
        <div className="relative">
          <Search aria-hidden className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label={t.input} placeholder={t.inputPlaceholder} className="ps-8" readOnly />
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">{t.statusNote}</p>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="secondary" className="bg-success/12 text-success">{t.success}</Badge>
            <Badge variant="secondary" className="bg-warning/15 text-warning">{t.warning}</Badge>
            <Badge variant="destructive">{t.error}</Badge>
            <Badge variant="secondary" className="bg-info/12 text-info">{t.info}</Badge>
          </div>
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">{t.chart}</p>
          <div aria-hidden className="flex h-16 items-end gap-1.5">
            {BARS.map((height, index) => (
              <span
                key={index}
                className="flex-1 rounded-t-md"
                style={{ height: `${height}%`, background: `var(--chart-${index + 1})` }}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
