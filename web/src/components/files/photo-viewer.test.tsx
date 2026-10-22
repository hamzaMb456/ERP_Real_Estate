import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PhotoViewer } from './photo-viewer';

// The ERP viewer loads photos through the authenticated Nhost client; the test only needs to know it was used.
vi.mock('@/components/files/storage-image', () => ({
  StorageImage: ({ fileId, alt }: { fileId: string; alt: string }) => <div data-testid="storage-image" data-file={fileId} aria-label={alt} />,
}));

const photos = [
  { id: 'p1', storage_file_id: 'file-1', title: 'Salon' },
  { id: 'p2', storage_file_id: 'file-2', title: 'Chambre' },
];

describe('PhotoViewer', () => {
  it('shows nothing while no photo is selected', () => {
    render(<PhotoViewer photos={photos} index={null} onIndexChange={() => {}} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps loading photos through the authenticated storage image by default (ERP)', () => {
    render(<PhotoViewer photos={photos} index={0} onIndexChange={() => {}} />);
    expect(screen.getByTestId('storage-image')).toHaveAttribute('data-file', 'file-1');
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('renders a plain image from imageSrc when given (public site, no session)', () => {
    const imageSrc = vi.fn((fileId: string, width: number) => `/photos/${fileId}?w=${width}`);
    render(<PhotoViewer photos={photos} index={1} onIndexChange={() => {}} imageSrc={imageSrc} />);
    const image = screen.getByRole('img', { name: 'Chambre' });
    expect(image).toHaveAttribute('src', '/photos/file-2?w=1600');
    expect(screen.queryByTestId('storage-image')).not.toBeInTheDocument();
    expect(imageSrc).toHaveBeenCalledWith('file-2', 1600);
  });

  it('replaces the built-in close button with a localised one when closeLabel is given', () => {
    const onIndexChange = vi.fn();
    render(<PhotoViewer photos={photos} index={0} onIndexChange={onIndexChange} imageSrc={(id) => `/${id}`} closeLabel="Fermer" />);
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));
    expect(onIndexChange).toHaveBeenCalledWith(null);
  });

  it('goes to the next photo, wrapping around, with the arrow buttons', () => {
    const onIndexChange = vi.fn();
    render(<PhotoViewer photos={photos} index={1} onIndexChange={onIndexChange} imageSrc={(id) => `/${id}`} />);
    fireEvent.click(screen.getByRole('button', { name: /Suivante/ }));
    expect(onIndexChange).toHaveBeenCalledWith(0);
  });
});
