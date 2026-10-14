const STATUS: Record<string, { label: string; className: string }> = {
  vacant: { label: 'Disponible', className: 'bg-amber-50 text-amber-800 border-amber-200' },
  rented: { label: 'Loué', className: 'bg-[#ECFDF5] text-brand border-[#A7F3D0]' },
  for_sale: { label: 'À vendre', className: 'bg-sky-50 text-sky-800 border-sky-200' },
  sold: { label: 'Vendu', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  under_maintenance: { label: 'En travaux', className: 'bg-orange-50 text-orange-800 border-orange-200' },
};

export function StatusPill({ status, label }: { status: string; label?: string }) {
  const entry = STATUS[status] ?? { label: status, className: 'bg-slate-100 text-slate-700 border-slate-200' };
  return (
    <span
      className={
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ' + entry.className
      }
    >
      {label ?? entry.label}
    </span>
  );
}
