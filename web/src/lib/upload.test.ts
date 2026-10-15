import { describe, expect, it, vi } from 'vitest';
import { fileTargetWhere, uploadAndLink, type UploadDeps } from './upload';

const file = new File(['x'], 'facade.png', { type: 'image/png' });
const meta = { kind: 'photo' as const, category: null, title: 'Facade', sortOrder: 3 };

function deps(over: Partial<UploadDeps> = {}): UploadDeps {
  return {
    upload: vi.fn().mockResolvedValue('file-1'),
    remove: vi.fn().mockResolvedValue(undefined),
    link: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
}

describe('uploadAndLink', () => {
  it('uploads then links the file to a bien', async () => {
    const d = deps();
    await uploadAndLink(file, { propertyId: 'p1' }, meta, d);
    expect(d.link).toHaveBeenCalledWith({
      property_id: 'p1',
      storage_file_id: 'file-1',
      kind: 'photo',
      category: null,
      title: 'Facade',
      sort_order: 3,
    });
    expect(d.remove).not.toHaveBeenCalled();
  });

  it('defaults a document category to "other" and links to a unit', async () => {
    const d = deps();
    await uploadAndLink(file, { unitId: 'u1' }, { ...meta, kind: 'document' }, d);
    expect(d.link).toHaveBeenCalledWith(expect.objectContaining({ unit_id: 'u1', kind: 'document', category: 'other' }));
  });

  it('deletes the stored file when linking fails, and rethrows the original error', async () => {
    const failure = new Error('permission denied');
    const d = deps({ link: vi.fn().mockRejectedValue(failure), remove: vi.fn().mockRejectedValue(new Error('also down')) });
    await expect(uploadAndLink(file, { propertyId: 'p1' }, meta, d)).rejects.toBe(failure);
    expect(d.remove).toHaveBeenCalledWith('file-1');
  });
});

describe('fileTargetWhere', () => {
  it('filters by kind and target', () => {
    expect(fileTargetWhere({ propertyId: 'p1' }, 'photo')).toEqual({ kind: { _eq: 'photo' }, property_id: { _eq: 'p1' } });
    expect(fileTargetWhere({ unitId: 'u1' }, 'document')).toEqual({ kind: { _eq: 'document' }, unit_id: { _eq: 'u1' } });
  });
});
