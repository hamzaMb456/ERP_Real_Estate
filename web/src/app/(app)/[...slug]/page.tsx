import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Construction } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

  return (
    <div className="space-y-6">
      <PageHeader title={label} description="Cette page est prévue dans les maquettes." />
      <Card className="border-dashed bg-muted/40">
        <CardHeader className="items-center text-center">
          <span className="mb-2 flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <Construction className="size-5" />
          </span>
          <CardTitle>En cours de développement</CardTitle>
          <CardDescription className="max-w-md">
            Le module « {label} » sera construit dans une prochaine étape. En attendant, les biens, les unités et les
            contacts sont déjà disponibles.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center gap-2">
          <Button asChild>
            <Link href="/biens">Voir les biens</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/contacts">Voir les contacts</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
