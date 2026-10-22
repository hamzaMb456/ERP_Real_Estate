'use client';

import { useState } from 'react';
import { enGB, fr, arTN, type Locale as DateFnsLocale } from 'date-fns/locale';
import { CalendarDays, ChevronLeft, ChevronRight } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { Locale } from '@/i18n/config';
import { useI18n } from '@/i18n/provider';
import type { CalendarViewName } from './calendar-types';
import { dateFromIso, isoFromDate } from './calendar-date';

/** Day names and first day for the date picker, in the same language as the grid. */
const PICKER_LOCALES: Record<Locale, DateFnsLocale> = { fr, en: enGB, ar: arTN };

type Props = {
  view: CalendarViewName;
  /** The period shown by the grid, e.g. « octobre 2026 ». */
  title: string;
  /** The day the grid is on (yyyy-mm-dd); the date picker starts there. */
  date: string;
  onViewChange: (view: CalendarViewName) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onPickDate: (iso: string) => void;
};

/**
 * The calendar's own header: step through periods, jump to a day with the date picker, switch the view.
 * Arrows are mirrored in Arabic (rtl:-scale-x-100), so « previous » always points back in time.
 */
export function CalendarToolbar({ view, title, date, onViewChange, onPrev, onNext, onToday, onPickDate }: Props) {
  const { locale, t } = useI18n();
  const v = t.calendar.view;
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <ButtonGroup aria-label={v.label}>
          <Button variant="outline" size="icon" aria-label={v.prevHint} title={v.prevHint} onClick={onPrev}>
            <ChevronLeft className="rtl:-scale-x-100" />
          </Button>
          <Button variant="outline" onClick={onToday} title={v.todayHint}>
            {v.today}
          </Button>
          <Button variant="outline" size="icon" aria-label={v.nextHint} title={v.nextHint} onClick={onNext}>
            <ChevronRight className="rtl:-scale-x-100" />
          </Button>
        </ButtonGroup>

        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="font-semibold capitalize" aria-label={v.pickDate} title={v.pickDate}>
              <CalendarDays data-icon="inline-start" />
              <span aria-live="polite">{title}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-2">
            <Calendar
              mode="single"
              selected={dateFromIso(date)}
              defaultMonth={dateFromIso(date)}
              onSelect={(day) => {
                if (!day) return;
                onPickDate(isoFromDate(day));
                setPickerOpen(false);
              }}
              locale={PICKER_LOCALES[locale]}
            />
          </PopoverContent>
        </Popover>
      </div>

      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={view}
        onValueChange={(next) => next && onViewChange(next as CalendarViewName)}
        aria-label={v.viewGroup}
      >
        <ToggleGroupItem value="dayGridMonth">{v.month}</ToggleGroupItem>
        <ToggleGroupItem value="timeGridWeek">{v.week}</ToggleGroupItem>
        <ToggleGroupItem value="listWeek">{v.list}</ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
