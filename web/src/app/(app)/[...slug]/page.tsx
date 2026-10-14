import { notFound } from 'next/navigation';
import { Construction } from 'lucide-react';
import { NAVIGATION, findTrail } from '@/lib/navigation';

const KNOWN_PATHS = new Set(
  NAVIGATION.flatMap((item) => [item.href, ...(item.children?.map((child) => child.href) ?? [])]),
);

export default async function PlaceholderPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const pathname = '/' + slug.join('/');
  if (!KNOWN_PATHS.has(pathname)) notFound();
  const title = findTrail(pathname).at(-1) ?? 'Page';

  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-line bg-white p-8">
      <Construction size={24} aria-hidden className="text-primary" />
      <h1 className="text-xl font-semibold text-ink">{title}</h1>
      <p className="max-w-prose text-sm text-muted">
        Cette page est prévue dans les maquettes et sera développée dans une prochaine étape.
      </p>
    </div>
  );
}
