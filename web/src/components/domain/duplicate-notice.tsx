import Link from 'next/link';
import { TriangleAlert } from 'lucide-react';
import type { DuplicateField, DuplicateMatch } from '@/lib/contact-duplicates';

import { useT } from '@/i18n/provider';
export function DuplicateNotice({ matches }: { matches: DuplicateMatch[] }) {
  const t = useT();
  if (matches.length === 0) return null;
  const fieldLabels: Record<DuplicateField, string> = {
    national_id: t.contacts.duplicates.nationalId,
    email: t.contacts.duplicates.email,
    phone: t.contacts.duplicates.phone,
  };
  return (
    <div role="status" className="space-y-2 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
      <p className="flex items-center gap-2 font-medium">
        <TriangleAlert className="size-4 text-warning" aria-hidden />
        {t.contacts.duplicates.title}
      </p>
      <ul className="space-y-1">
        {matches.map((match) => (
          <li key={match.contact.id}>
            {t.contacts.duplicates.same(match.fields.map((field) => fieldLabels[field]).join(t.contacts.duplicates.separator))}{' '}
            <Link href={'/contacts/' + match.contact.id} target="_blank" className="font-medium text-primary underline">
              {match.contact.full_name}
            </Link>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">{t.contacts.duplicates.saveAnyway}</p>
    </div>
  );
}
