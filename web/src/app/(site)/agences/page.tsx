import type { Metadata } from 'next';
import Link from 'next/link';
import { getAgencies, type PublicAgency } from '@/lib/site/agencies';
import { siteConfig } from '@/lib/site/config';

export const metadata: Metadata = {
  title: `Nos agences immobilières | ${siteConfig.agencyName}`,
  description: `Les agences ${siteConfig.agencyName} par région et par ville : adresse, téléphone et annonces de chaque agence.`,
  alternates: { canonical: '/agences' },
};

/** Groups the agencies by region, then keeps the order of the list (region, city). */
function byRegion(agencies: PublicAgency[]): [string, PublicAgency[]][] {
  const groups = new Map<string, PublicAgency[]>();
  for (const agency of agencies) {
    const key = agency.region || 'Autres';
    groups.set(key, [...(groups.get(key) ?? []), agency]);
  }
  return [...groups.entries()];
}

export default async function AgenciesPage() {
  const agencies = await getAgencies();
  return (
    <main className="mx-auto w-full max-w-5xl space-y-10 px-4 py-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Nos agences</h1>
        <p className="text-muted-foreground">Trouvez l&apos;agence la plus proche de vous, avec ses annonces.</p>
      </header>
      {agencies.length === 0 && <p className="text-muted-foreground">Aucune agence publiée pour le moment.</p>}
      {byRegion(agencies).map(([region, list]) => (
        <section key={region} className="space-y-4">
          <h2 className="text-xl font-medium">{region}</h2>
          <ul className="grid gap-4 sm:grid-cols-2">
            {list.map((agency) => (
              <li key={agency.id}>
                <Link href={`/agences/${agency.slug}`} className="block rounded-lg border p-5 transition hover:bg-muted/50">
                  <p className="font-medium">{agency.name}</p>
                  {agency.city && <p className="text-sm text-muted-foreground">{agency.city}</p>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
