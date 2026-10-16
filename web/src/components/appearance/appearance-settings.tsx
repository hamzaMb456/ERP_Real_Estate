'use client';

import { useEffect } from 'react';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useT } from '@/i18n/provider';
import { cn } from '@/lib/utils';
import {
  COLOR_ROLES,
  PALETTES,
  effectiveColors,
  getPalette,
  isDefaultSelection,
  sameSelection,
  seedOf,
  type ColorRole,
  type Selection,
} from '@/theme/palettes';
import { generateTheme } from '@/theme/generate';
import { useAppearance } from '@/theme/provider';
import { applySelection, cancelPreview, previewSelection, resetSelection } from '@/theme/store';
import { ColorField } from './color-field';
import { PaletteSwatch } from './palette-swatch';
import { PreviewPanel } from './preview-panel';
import { SavedPalettes } from './saved-palettes';

const MODES = [
  { value: 'light', icon: Sun },
  { value: 'dark', icon: Moon },
  { value: 'system', icon: Monitor },
] as const;

export function AppearanceSettings() {
  const t = useT();
  const a = t.appearance;
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { current, prefs, preview, ready } = useAppearance();
  const mode = resolvedTheme === 'dark' ? 'dark' : 'light';

  // Leaving the page drops an unsaved preview: the saved palette comes back.
  useEffect(() => () => cancelPreview(), []);

  const dirty = preview !== null && !sameSelection(preview, prefs.selection);
  const colors = effectiveColors(current);
  const base = getPalette(current.baseId);
  const primaryAdjusted = generateTheme(seedOf(current)).primaryAdjusted;
  const customized = Object.keys(current.overrides).length > 0;
  const accentFollows = !base?.seed.accent && !current.overrides.accent;

  function pickPalette(id: string) {
    previewSelection({ baseId: id, overrides: {} });
  }

  function setColor(role: ColorRole, hex: string) {
    previewSelection({ baseId: current.baseId, overrides: { ...current.overrides, [role]: hex } });
  }

  function revertColor(role: ColorRole) {
    const rest: Selection['overrides'] = { ...current.overrides };
    delete rest[role];
    previewSelection({ baseId: current.baseId, overrides: rest });
  }

  function apply() {
    applySelection(current);
    toast.success(a.actions.applied);
  }

  function reset() {
    resetSelection();
    toast.success(a.actions.resetDone);
  }

  const roleLabels: Record<ColorRole, string> = {
    primary: a.colors.primary,
    accent: a.colors.accent,
    background: a.colors.background,
  };

  function hintFor(role: ColorRole): string | undefined {
    if (role === 'accent' && accentFollows) return a.colors.followsPrimary;
    if (role === 'background') return a.colors.backgroundHint;
    return undefined;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={a.title}
        description={a.description}
        actions={
          <>
            {dirty && (
              <Button type="button" variant="ghost" onClick={cancelPreview}>
                {a.actions.cancel}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={reset}
              disabled={!ready || (isDefaultSelection(prefs.selection) && !dirty)}
            >
              {a.actions.reset}
            </Button>
            <Button type="button" onClick={apply} disabled={!dirty}>
              <Check data-icon="inline-start" />
              {a.actions.apply}
            </Button>
          </>
        }
      />

      {dirty && (
        <p role="status" className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm text-primary">
          {a.actions.previewing}
        </p>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{a.palettes.heading}</CardTitle>
              <CardDescription>{a.palettes.hint}</CardDescription>
            </CardHeader>
            <CardContent>
              <div role="radiogroup" aria-label={a.palettes.heading} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {PALETTES.map((palette) => {
                  const selected = palette.id === current.baseId;
                  const text = a.palettes.items[palette.id] ?? { name: palette.label, description: palette.description };
                  return (
                    <button
                      key={palette.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => pickPalette(palette.id)}
                      className={cn(
                        'group flex flex-col gap-2.5 rounded-xl border bg-card p-3 text-start transition-all',
                        'hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
                        selected && 'border-primary ring-2 ring-primary/40',
                      )}
                    >
                      <PaletteSwatch selection={{ baseId: palette.id, overrides: {} }} mode={mode} />
                      <span className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{text.name}</span>
                        {selected && customized && (
                          <Badge variant="secondary" className="h-4 px-1.5 text-[0.65rem]">
                            {a.saved.custom}
                          </Badge>
                        )}
                        {selected && <Check aria-hidden className="ms-auto size-4 text-primary" />}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {text.description}
                        {palette.seed.scheme === 'dark' ? ' ' + a.palettes.darkNote : ''}
                      </span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{a.colors.heading}</CardTitle>
              <CardDescription>{a.colors.hint}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-3">
              {COLOR_ROLES.map((role) => (
                <ColorField
                  key={role}
                  label={roleLabels[role]}
                  value={colors[role]}
                  onChange={(hex) => setColor(role, hex)}
                  overridden={Boolean(current.overrides[role])}
                  onRevert={() => revertColor(role)}
                  hint={hintFor(role)}
                />
              ))}
              {primaryAdjusted && (
                <p role="note" className="text-xs text-muted-foreground sm:col-span-3">
                  {a.colors.adjusted}
                </p>
              )}
            </CardContent>
          </Card>

          <SavedPalettes saved={prefs.saved} current={current} mode={mode} />
        </div>

        <div className="space-y-6 lg:sticky lg:top-20">
          <Card>
            <CardHeader>
              <CardTitle>{a.mode.heading}</CardTitle>
              <CardDescription>{a.mode.hint}</CardDescription>
            </CardHeader>
            <CardContent>
              <div role="radiogroup" aria-label={a.mode.heading} className="grid grid-cols-3 gap-2">
                {MODES.map(({ value, icon: Icon }) => (
                  <Button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={(theme ?? 'system') === value}
                    variant={(theme ?? 'system') === value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTheme(value)}
                  >
                    <Icon data-icon="inline-start" />
                    {t.shell.theme[value]}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
          <PreviewPanel />
        </div>
      </div>
    </div>
  );
}
