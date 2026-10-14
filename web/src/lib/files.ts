export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export type FileKind = 'photo' | 'document';

const ACCEPTED: Record<FileKind, string[]> = {
  photo: ['image/jpeg', 'image/png', 'image/webp'],
  document: ['application/pdf', 'image/jpeg', 'image/png'],
};

const FORMATS: Record<FileKind, string> = { photo: 'JPG, PNG ou WebP', document: 'PDF, JPG ou PNG' };

export const ACCEPT_ATTR: Record<FileKind, string> = {
  photo: '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp',
  document: '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png',
};

export const DOCUMENT_CATEGORIES = {
  title_deed: 'Titre foncier',
  plan: 'Plans',
  certificate: 'Certificats',
  contract: 'Contrats',
  other: 'Autres',
} as const;

export type DocumentCategory = keyof typeof DOCUMENT_CATEGORIES;

export function formatsLabel(kind: FileKind): string {
  return FORMATS[kind];
}

export function validateFile(file: { name: string; size: number; type: string }, kind: FileKind): string | null {
  if (!ACCEPTED[kind].includes(file.type)) return `Format non accepté pour « ${file.name} » (${FORMATS[kind]}).`;
  if (file.size === 0) return `Fichier vide : « ${file.name} ».`;
  if (file.size > MAX_FILE_BYTES) return `Fichier trop lourd : « ${file.name} » (max 10 Mo).`;
  return null;
}

export function titleFromFileName(name: string): string {
  const base = name.replace(/\.[^.]*$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : 'Sans titre';
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
