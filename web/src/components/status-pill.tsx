const STATUS: Record<string, { label: string; className: string }> = {
  vacant: { label: 'Vacant', className: 'bg-amber-50 text-amber-800' },
  rented: { label: 'Loué', className: 'bg-soft text-primary' },
  for_sale: { label: 'À vendre', className: 'bg-sky-50 text-sky-800' },
  sold: { label: 'Vendu', className: 'bg-slate-100 text-slate-700' },
  under_maintenance: { label: 'En travaux', className: 'bg-orange-50 text-orange-800' },
};

export function StatusPill({ status }: { status: string }) {
  const entry = STATUS[status] ?? { label: status, className: 'bg-slate-100 text-slate-700' };
  return (
    <span className={'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ' + entry.className}>
      {entry.label}
    </span>
  );
}
