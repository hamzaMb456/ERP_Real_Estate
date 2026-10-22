import { PlaceholderCard } from '@/components/placeholder-card';

/** A fixed route so « /erp/baux/demandes » is not read as a lease id by « /erp/baux/[id] ». Rent requests arrive with Plan C. */
export default function RentRequestsPage() {
  return <PlaceholderCard labelKey="rentalRequests" />;
}
