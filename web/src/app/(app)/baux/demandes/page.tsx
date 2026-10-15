import { PlaceholderCard } from '@/components/placeholder-card';

/** A fixed route so « /baux/demandes » is not read as a lease id by « /baux/[id] ». Rent requests arrive with Plan C. */
export default function RentRequestsPage() {
  return <PlaceholderCard label="Demandes de location" />;
}
