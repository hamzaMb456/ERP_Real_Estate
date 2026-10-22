import type { Metadata } from 'next';
import { SearchPage, searchMetadata, type SearchPageProps } from '@/components/site/search-page';

export function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  return searchMetadata('rent', searchParams);
}

export default function LouerPage({ searchParams }: SearchPageProps) {
  return <SearchPage mode="rent" searchParams={searchParams} />;
}
