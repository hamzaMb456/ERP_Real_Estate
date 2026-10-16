import type { Locale } from '../config';
import { ar } from './ar';
import { en } from './en';
import { fr } from './fr';

/** The French dictionary is the reference: every other language must have the same keys, enforced by the type. */
export type Messages = typeof fr;

export const MESSAGES: Record<Locale, Messages> = { fr, en, ar };
