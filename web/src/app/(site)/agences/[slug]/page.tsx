import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAgency } from '@/lib/site/agencies';
import { siteConfig } from '@/lib/site/config';

type AgencyPageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: AgencyPageProps): Promise<Metadata> {
  const { slug } = await params;
  const agency = await getAgency(slug);
  if (!agency) return { title: `Agence introuvable | ${siteConfig.agencyName}`, robots: { index: false, follow: false } };
  const where = agency.city ? ` à ${agency.city}` : '';
  const area = agency.region ? ` (${agency.region})` : '';
  return {
    title: `Agence immobilière${where} | ${agency.name}`,
    description: `Agence ${agency.name}${area} : adresse, téléphone et annonces immobilières${where}.`,
    alternates: { canonical: `/agences/${agency.slug}` },
  };
}

export default async function AgencyPage({ params }: AgencyPageProps) {
  const { slug } = await params;
  const agency = await getAgency(slug);
  if (!agency) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl space-y-8 px-4 py-10">
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">
          <Link href="/agences" className="underline-offset-4 hover:underline">Nos agences</Link>
          {agency.region ? ` · ${agency.region}` : ''}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">{agency.name}</h1>
        {agency.city && <p className="text-muted-foreground">{agency.city}</p>}
      </header>

      <section className="space-y-2 rounded-lg border p-5">
        {agency.address && <p>{agency.address}</p>}
        {agency.phone && (
          <p>
            <a href={`tel:${agency.phone.replace(/\s+/g, '')}`} className="underline-offset-4 hover:underline">{agency.phone}</a>
          </p>
        )}
      </section>

      {agency.city && (
        <section className="flex flex-wrap gap-3">
          <Link href={`/louer?ville=${encodeURIComponent(agency.city)}`} className="rounded-md border px-4 py-2 hover:bg-muted/50">
            Location à {agency.city}
          </Link>
          <Link href={`/acheter?ville=${encodeURIComponent(agency.city)}`} className="rounded-md border px-4 py-2 hover:bg-muted/50">
            Vente à {agency.city}
          </Link>
        </section>
      )}
    </main>
  );
}
