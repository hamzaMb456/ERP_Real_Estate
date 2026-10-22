import type { ReactNode } from 'react';
import type { LucideIcon } from '@/components/icons';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { cn } from '@/lib/utils';

type Props = {
  icon: LucideIcon;
  title: string;
  body?: string;
  /** A shortcut under the text (clear the filters, plan an appointment…). */
  action?: ReactNode;
  className?: string;
};

/** « Nothing here » for the calendar, lists and cards: the shared Empty block with the module's icon. */
export function CalendarEmptyState({ icon: Icon, title, body, action, className }: Props) {
  return (
    <Empty className={cn('border bg-muted/30', className)}>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        {body && <EmptyDescription>{body}</EmptyDescription>}
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  );
}
