import type { Metadata } from 'next';
import { SearchPage, searchMetadata, type SearchPageProps } from '@/components/site/search-page';

export function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  return searchMetadata('sale', searchParams);
}

export default function AcheterPage({ searchParams }: SearchPageProps) {
  return <SearchPage mode="sale" searchParams={searchParams} />;
}
