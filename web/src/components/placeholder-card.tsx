import Link from 'next/link';
import { Construction } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function PlaceholderCard({ label }: { label: string }) {
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
            Le module « {label} » sera construit dans une prochaine étape. En attendant, les biens, les unités et les contacts sont
            déjà disponibles.
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
