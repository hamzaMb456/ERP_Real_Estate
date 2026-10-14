export type ContactRole = 'owner' | 'renter' | 'buyer';

export const CONTACT_ROLES: { value: ContactRole; label: string; className: string }[] = [
  { value: 'owner', label: 'Propriétaire', className: 'bg-soft text-primary' },
  { value: 'renter', label: 'Locataire', className: 'bg-sky-50 text-sky-800' },
  { value: 'buyer', label: 'Acquéreur', className: 'bg-amber-50 text-amber-800' },
];

export function RolePill({ role }: { role: string }) {
  const entry = CONTACT_ROLES.find((item) => item.value === role);
  const label = entry?.label ?? role;
  const className = entry?.className ?? 'bg-slate-100 text-slate-700';
  return (
    <span className={'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ' + className}>{label}</span>
  );
}
