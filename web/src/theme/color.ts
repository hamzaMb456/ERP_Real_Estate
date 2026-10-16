// Colour maths for the theme system: hex <-> OKLCH, WCAG contrast. No dependencies.
// OKLCH is the working space because lightness and chroma stay perceptually even across hues,
// so one recipe (lightness / chroma steps) yields coherent surfaces for any primary colour.

export type Oklch = { l: number; c: number; h: number };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const fromLinear = (v: number) => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);

/** `#rgb` / `#rrggbb` (case-insensitive) to sRGB channels in 0..1, or null when malformed. */
export function parseHex(hex: string): [number, number, number] | null {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const digits = match[1].length === 3 ? [...match[1]].map((d) => d + d).join('') : match[1];
  const n = parseInt(digits, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** Normalises user input to lowercase `#rrggbb`, or null. */
export function normalizeHex(value: string): string | null {
  const rgb = parseHex(value);
  if (!rgb) return null;
  return '#' + rgb.map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
}

function linearRgbToOklch(r: number, g: number, b: number): Oklch {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const c = Math.hypot(a, bb);
  const h = c < 1e-4 ? 0 : ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360;
  return { l: L, c, h };
}

/** Linear sRGB (unclamped) of an OKLCH colour. */
function oklchToLinearRgb({ l, c, h }: Oklch): [number, number, number] {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
}

export function hexToOklch(hex: string): Oklch | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  return linearRgbToOklch(...(rgb.map(toLinear) as [number, number, number]));
}

/** OKLCH to `#rrggbb`; out-of-gamut colours are clipped channel by channel. */
export function oklchToHex(color: Oklch): string {
  const channels = oklchToLinearRgb(color).map((v) => Math.round(clamp(fromLinear(clamp(v, 0, 1)), 0, 1) * 255));
  return '#' + channels.map((v) => v.toString(16).padStart(2, '0')).join('');
}

function round(value: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

/** CSS `oklch()` string; `alpha` below 1 adds the slash form. */
export function css(l: number, c: number, h: number, alpha = 1): string {
  const base = `${round(clamp(l, 0, 1), 3)} ${round(Math.max(0, c), 3)} ${round(((h % 360) + 360) % 360, 1)}`;
  return alpha < 1 ? `oklch(${base} / ${round(alpha, 2)})` : `oklch(${base})`;
}

export function oklchCss(color: Oklch, alpha = 1): string {
  return css(color.l, color.c, color.h, alpha);
}

/** WCAG relative luminance. */
export function luminance(color: Oklch): number {
  const [r, g, b] = oklchToLinearRgb(color).map((v) => clamp(v, 0, 1));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colours (1..21). */
export function contrast(a: Oklch, b: Oklch): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Moves `color` along the lightness axis (away from `against`) until it reaches `minimum` contrast.
 * Hue and chroma are kept, so the result still reads as the same colour.
 */
export function ensureContrast(color: Oklch, against: Oklch, minimum: number): { color: Oklch; adjusted: boolean } {
  if (contrast(color, against) >= minimum) return { color, adjusted: false };
  const step = against.l > 0.6 ? -0.01 : 0.01;
  let next = color;
  for (let i = 0; i < 100; i++) {
    next = { ...next, l: clamp(next.l + step, 0, 1) };
    if (contrast(next, against) >= minimum || next.l <= 0 || next.l >= 1) break;
  }
  return { color: next, adjusted: true };
}

/** Smallest angle between two hues, in degrees (0..180). */
export function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}
