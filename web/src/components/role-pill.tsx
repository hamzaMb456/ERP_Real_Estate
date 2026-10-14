export type ContactRole = 'owner' | 'renter' | 'buyer';

export const CONTACT_ROLES: {
  value: ContactRole;
  label: string;
  description: string;
  pill: string;
  avatar: string;
  tile: string;
}[] = [
  {
    value: 'owner',
    label: 'Propriétaire',
    description: 'Possède un bien ou une unité que nous gérons.',
    pill: 'bg-emerald-50 text-brand border-emerald-200',
    avatar: 'bg-emerald-100 text-brand',
    tile: 'bg-emerald-50 text-brand',
  },
  {
    value: 'renter',
    label: 'Locataire',
    description: 'Loue une unité avec un bail.',
    pill: 'bg-slate-100 text-slate-700 border-slate-200',
    avatar: 'bg-slate-100 text-slate-700',
    tile: 'bg-slate-100 text-slate-700',
  },
  {
    value: 'buyer',
    label: 'Acquéreur',
    description: 'Achète une unité ou a fait une offre.',
    pill: 'bg-amber-50 text-amber-800 border-amber-200',
    avatar: 'bg-amber-100 text-amber-800',
    tile: 'bg-amber-50 text-amber-700',
  },
];

export function RolePill({ role }: { role: string }) {
  const entry = CONTACT_ROLES.find((item) => item.value === role);
  const className = entry?.pill ?? 'bg-slate-100 text-slate-700 border-slate-200';
  return (
    <span
      className={'inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-semibold ' + className}
    >
      {entry?.label ?? role}
    </span>
  );
}
