# Theme system

One place owns the visual identity of the app: **seed colours in, a complete token set out**.
It is independent of business logic and has no extra dependency (colour maths is in `color.ts`).

```
palettes.ts   built-in palettes (seeds) + selection rules        <- add palettes here
generate.ts   seed -> every CSS token, light and dark             <- the single recipe
color.ts      hex <-> OKLCH, WCAG contrast
storage.ts    persistence adapter (localStorage, one key per user)
store.ts      preferences + live preview (useSyncExternalStore)
provider.tsx  <AppearanceSync/> applies the tokens to <html>
script.ts     inline <head> script: paints the saved theme before first paint (no flash)
```

## How it works

1. **Defaults** live in `src/app/globals.css` (`:root` and `.dark`): that is the EAM Green theme, the
   fallback when nothing is saved. Components never hard-code a brand colour; they use tokens
   (`bg-primary`, `text-muted-foreground`, `var(--sidebar-panel)`, ...).
2. A **selection** is a built-in palette plus optional colour overrides (`primary`, `accent`,
   `background`). `generateTheme(seed)` derives surfaces, borders, text, charts, gradients and the sidebar
   for both modes, and nudges the primary until it reaches WCAG AA against the card colour.
3. The result is one `<style id="erp-theme">` (selectors `html:root` / `html.dark`, so it outranks the
   defaults). Light / dark / system is still handled by `next-themes`; palettes and modes are independent.
4. Saving mirrors the generated CSS to `localStorage["erp.theme.active"]`; `THEME_SCRIPT` (in
   `app/layout.tsx`) injects it before first paint. Choosing the default palette removes it.
5. Preferences are stored per signed-in user (`erp.theme.v1:<userId>`). A first sign-in inherits the choice
   made while signed out. Replace `localThemeStorage` (`ThemeStorage` interface) to sync with a database.

Status colours (`--destructive`, `--success`, `--warning`, `--info`) are **never generated**: they keep
their meaning in every palette. Chart hues 2 to 5 stay categorical but are moved away from the primary hue.

## Add a palette

Append one entry to `PALETTES` in `palettes.ts`:

```ts
{
  id: 'forest',                       // stable id, stored in user preferences
  label: 'Forest',                    // English fallback name
  description: 'Deep greens on warm paper.',
  seed: {
    primary: ok(0.46, 0.09, 150),     // brand colour (hex or ok(l, c, h))
    accent: ok(0.7, 0.12, 95),        // optional; omitted = primary hue shifted by 25 degrees
    background: ok(0.985, 0.007, 100),// page colour of the palette native scheme
    scheme: 'light',                  // 'dark' = switches the app to dark when chosen (Midnight)
    depth: 0,                         // 0..1, darkens the sidebar panel
  },
},
```

Optionally add translated names under `palettes.items.<id>` in `src/i18n/messages/{fr,en,ar}/appearance.ts`
(without it the English `label` is shown). The Appearance page, previews and persistence pick it up
automatically. `generate.test.ts` checks every palette for completeness and AA contrast.

## Change the default theme

Edit the `:root` / `.dark` blocks in `globals.css` (defaults) and the matching `eam-green` seed in
`palettes.ts` (used by swatches and as the base of custom colours). `isDefaultSelection` decides when
nothing needs injecting.

## Add a new themed token

1. Give it a default in `globals.css` (`:root`).
2. Emit it in `generate.ts` (`build`) so every palette defines it.
3. Use `var(--your-token)` in CSS. Avoid literal `oklch(... 165)` hues: use `var(--theme-hue)` for tints.

## Where users change it

`/administration/apparence` (Administration > Appearance, and "Customise appearance" in the header theme
menu): palette picker, three colour inputs, live preview with Apply / Cancel, restore defaults, and named
saved palettes.
