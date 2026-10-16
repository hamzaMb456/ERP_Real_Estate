import { notFound } from 'next/navigation';
import { PlaceholderCard } from '@/components/placeholder-card';
import { NAVIGATION, type NavKey } from '@/lib/navigation';

function findKey(pathname: string): NavKey | null {
  for (const item of NAVIGATION) {
    if (item.href === pathname && !item.children) return item.key;
    const child = item.children?.find((entry) => entry.href === pathname);
    if (child) return child.key;
  }
  return null;
}

export default async function PlaceholderPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const key = findKey('/' + slug.join('/'));
  if (!key) notFound();

  return <PlaceholderCard labelKey={key} />;
}
