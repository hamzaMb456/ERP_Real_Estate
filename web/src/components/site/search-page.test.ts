import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/site/listings-queries', () => ({ PAGE_SIZE: 12, searchListings: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/components/map', () => ({ ListingsMap: () => null }));

import { searchMetadata } from './search-page';

describe('searchMetadata', () => {
  it('titles the rent and sale pages in French', async () => {
    expect((await searchMetadata('rent', Promise.resolve({}))).title).toBe('Logements à louer');
    expect((await searchMetadata('sale', Promise.resolve({}))).title).toBe('Biens à vendre');
  });

  it('appends the city when exactly one is selected, not with two', async () => {
    expect((await searchMetadata('rent', Promise.resolve({ ville: 'Carthage' }))).title).toBe('Logements à louer à Carthage');
    expect((await searchMetadata('rent', Promise.resolve({ ville: ['Carthage', 'Tunis'] }))).title).toBe('Logements à louer');
  });

  it('points every filtered or paginated URL to the bare page', async () => {
    const metadata = await searchMetadata('sale', Promise.resolve({ ville: 'Carthage', page: '3', prix_max: 'abc' }));
    expect(metadata.alternates?.canonical).toMatch(/\/acheter$/);
    expect(String(metadata.alternates?.canonical)).not.toContain('?');
  });

  it('survives garbage in the URL', async () => {
    const metadata = await searchMetadata('rent', Promise.resolve({ prix_max: 'abc', page: '-3', pieces: '99', ville: '<script>' }));
    expect(metadata.title).toBe('Logements à louer à <script>');
  });
});
