import { describe, expect, it, vi } from 'vitest';
import { uploadLeaseDocument } from './lease-files';

const file = new File(['x'], 'bail-signe_2026.pdf', { type: 'application/pdf' });

describe('uploadLeaseDocument', () => {
  it('stores the file, then links it to the lease with a readable title', async () => {
    const deps = { upload: vi.fn().mockResolvedValue('S1'), remove: vi.fn(), link: vi.fn().mockResolvedValue(undefined) };
    await uploadLeaseDocument(file, 'L1', 'signed_lease', deps);
    expect(deps.link).toHaveBeenCalledWith({ lease_id: 'L1', storage_file_id: 'S1', category: 'signed_lease', title: 'Bail signe 2026' });
    expect(deps.remove).not.toHaveBeenCalled();
  });

  it('removes the stored file when the link fails, and reports the failure', async () => {
    const deps = { upload: vi.fn().mockResolvedValue('S1'), remove: vi.fn().mockResolvedValue(undefined), link: vi.fn().mockRejectedValue(new Error('invalid_storage_file')) };
    await expect(uploadLeaseDocument(file, 'L1', 'other', deps)).rejects.toThrow('invalid_storage_file');
    expect(deps.remove).toHaveBeenCalledWith('S1');
  });

  it('still reports the link failure when the cleanup also fails', async () => {
    const deps = { upload: vi.fn().mockResolvedValue('S1'), remove: vi.fn().mockRejectedValue(new Error('network')), link: vi.fn().mockRejectedValue(new Error('invalid_storage_file')) };
    await expect(uploadLeaseDocument(file, 'L1', 'other', deps)).rejects.toThrow('invalid_storage_file');
  });

  it('does not link anything when the upload itself fails', async () => {
    const deps = { upload: vi.fn().mockRejectedValue(new Error('Le fichier n’a pas pu être envoyé.')), remove: vi.fn(), link: vi.fn() };
    await expect(uploadLeaseDocument(file, 'L1', 'other', deps)).rejects.toThrow('Le fichier n’a pas pu être envoyé.');
    expect(deps.link).not.toHaveBeenCalled();
  });
});
