import { getMessages } from '@/i18n/store';

export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export type FileKind = 'photo' | 'document';

const ACCEPTED: Record<FileKind, string[]> = {
  photo: ['image/jpeg', 'image/png', 'image/webp'],
  document: ['application/pdf', 'image/jpeg', 'image/png'],
};

export const ACCEPT_ATTR: Record<FileKind, string> = {
  photo: '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp',
  document: '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png',
};

/** Codes stored in the database; their labels live in the dictionary (files.categories). */
export const DOCUMENT_CATEGORY_KEYS = ['title_deed', 'plan', 'certificate', 'contract', 'other'] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORY_KEYS)[number];

export function formatsLabel(kind: FileKind): string {
  return getMessages().files.formats[kind];
}

export function validateFile(file: { name: string; size: number; type: string }, kind: FileKind): string | null {
  const t = getMessages().files;
  if (!ACCEPTED[kind].includes(file.type)) return t.invalidFormat(file.name, t.formats[kind]);
  if (file.size === 0) return t.emptyFile(file.name);
  if (file.size > MAX_FILE_BYTES) return t.tooLarge(file.name);
  return null;
}

export function titleFromFileName(name: string): string {
  const base = name.replace(/\.[^.]*$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : getMessages().files.untitled;
}

const EXTENSIONS: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** File name for a download: the title plus the extension of its type, so the system can open it. */
export function downloadName(title: string, mimeType: string): string {
  const extension = EXTENSIONS[mimeType];
  if (!extension || title.toLowerCase().endsWith('.' + extension)) return title;
  return `${title}.${extension}`;
}
