import type { OwnershipRow } from '@/lib/ownership';

export type PropertyUnit = {
  id: string;
  code: string;
  type: string;
  floor: number | null;
  rooms: number | null;
  surface_m2: number | string | null;
  rent_amount: number | string | null;
  status: string;
  archived_at: string | null;
  ownerships: OwnershipRow[];
  current_owners: { share_percent: number | string; contact: { id: string; full_name: string } }[];
};

export type PropertyDetails = {
  id: string;
  name: string;
  type: 'building' | 'house' | 'plot';
  address_line: string | null;
  city: string | null;
  governorate: string | null;
  postal_code: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  archived_at: string | null;
  branch: { id: string; name: string } | null;
  owners: { units_count: number; contact: { id: string; full_name: string; is_organization: boolean } }[];
  units: PropertyUnit[];
};
