import Link from 'next/link';
import { TriangleAlert } from 'lucide-react';
import type { DuplicateField, DuplicateMatch } from '@/lib/contact-duplicates';

const FIELD_LABELS: Record<DuplicateField, string> = {
  national_id: 'CIN / matricule',
  email: 'e-mail',
  phone: 'téléphone',
};

export function DuplicateNotice({ matches }: { matches: DuplicateMatch[] }) {
  if (matches.length === 0) return null;
  return (
    <div role="status" className="space-y-2 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
      <p className="flex items-center gap-2 font-medium">
        <TriangleAlert className="size-4 text-warning" aria-hidden />
        Ce contact existe peut-être déjà
      </p>
      <ul className="space-y-1">
        {matches.map((match) => (
          <li key={match.contact.id}>
            Même {match.fields.map((field) => FIELD_LABELS[field]).join(', ')} que{' '}
            <Link href={'/contacts/' + match.contact.id} target="_blank" className="font-medium text-primary underline">
              {match.contact.full_name}
            </Link>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">Vous pouvez tout de même enregistrer.</p>
    </div>
  );
}
