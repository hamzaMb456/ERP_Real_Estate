import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  icon: LucideIcon;
  title: string;
  body?: string;
  /** A shortcut under the text (clear the filters, plan an appointment…). */
  action?: ReactNode;
  className?: string;
};

/** Dashed muted block for « nothing here »: icon in a muted circle, title, explanation, optional shortcut. */
export function CalendarEmptyState({ icon: Icon, title, body, action, className }: Props) {
  return (
    <div className={cn('flex flex-col items-center gap-2 rounded-xl border border-dashed bg-muted/40 px-4 py-8 text-center', className)}>
      <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-5" aria-hidden />
      </span>
      <p className="font-medium">{title}</p>
      {body && <p className="max-w-sm text-sm text-muted-foreground">{body}</p>}
      {action}
    </div>
  );
}
