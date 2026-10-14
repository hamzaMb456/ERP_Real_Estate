import { describe, expect, it } from 'vitest';
import { downloadName, MAX_FILE_BYTES, titleFromFileName, validateFile } from './files';

describe('validateFile', () => {
  it('accepts allowed types under 10 MB', () => {
    expect(validateFile({ name: 'a.jpg', size: 1000, type: 'image/jpeg' }, 'photo')).toBeNull();
    expect(validateFile({ name: 'acte.pdf', size: 1000, type: 'application/pdf' }, 'document')).toBeNull();
  });
  it('refuses a PDF as a photo', () => {
    expect(validateFile({ name: 'acte.pdf', size: 1000, type: 'application/pdf' }, 'photo')).toBe(
      'Format non accepté pour « acte.pdf » (JPG, PNG ou WebP).',
    );
  });
  it('refuses files above 10 MB and empty files', () => {
    expect(validateFile({ name: 'big.png', size: MAX_FILE_BYTES + 1, type: 'image/png' }, 'photo')).toBe(
      'Fichier trop lourd : « big.png » (max 10 Mo).',
    );
    expect(validateFile({ name: 'vide.png', size: 0, type: 'image/png' }, 'photo')).toBe('Fichier vide : « vide.png ».');
  });
});

describe('titleFromFileName', () => {
  it('turns a file name into a readable title', () => {
    expect(titleFromFileName('facade_nord-2026.jpg')).toBe('Facade nord 2026');
    expect(titleFromFileName('.png')).toBe('Sans titre');
  });
});

describe('downloadName', () => {
  it('adds the extension that matches the file type', () => {
    expect(downloadName('Acte vente', 'application/pdf')).toBe('Acte vente.pdf');
    expect(downloadName('Plan', 'image/jpeg')).toBe('Plan.jpg');
  });
  it('keeps a title that already ends with the extension, and unknown types as they are', () => {
    expect(downloadName('acte.pdf', 'application/pdf')).toBe('acte.pdf');
    expect(downloadName('Notes', 'text/plain')).toBe('Notes');
  });
});
