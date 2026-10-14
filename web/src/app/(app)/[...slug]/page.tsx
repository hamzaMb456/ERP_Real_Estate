import { notFound } from 'next/navigation';
import { PlaceholderCard } from '@/components/placeholder-card';
import { NAVIGATION } from '@/lib/navigation';

function findLabel(pathname: string): string | null {
  for (const item of NAVIGATION) {
    if (item.href === pathname && !item.children) return item.label;
    const child = item.children?.find((entry) => entry.href === pathname);
    if (child) return child.label;
  }
  return null;
}

export default async function PlaceholderPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const label = findLabel('/' + slug.join('/'));
  if (!label) notFound();

  return <PlaceholderCard label={label} />;
}
