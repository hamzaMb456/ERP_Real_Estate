'use client';

import type { ContactOption } from '@/components/ownership/contact-picker';
import { useGraphql, type QueryState } from '@/lib/use-graphql';

const QUERY = `
  query ContactOptions {
    contacts(where: { archived_at: { _is_null: true } }, order_by: [{ is_organization: desc }, { full_name: asc }]) {
      id full_name kind is_organization
    }
  }
`;

/** Active contacts for owner pickers; the organization's own contact comes first. */
export function useContactOptions(): QueryState<ContactOption[]> {
  const result = useGraphql<{ contacts: ContactOption[] }>(QUERY);
  return result.status === 'success' ? { status: 'success', data: result.data.contacts } : result;
}
