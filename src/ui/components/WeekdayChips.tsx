import { Weekday } from '../../protocol/types';

const DAYS: { day: Weekday; label: string; full: string }[] = [
  { day: Weekday.Monday, label: 'M', full: 'Monday' },
  { day: Weekday.Tuesday, label: 'T', full: 'Tuesday' },
  { day: Weekday.Wednesday, label: 'W', full: 'Wednesday' },
  { day: Weekday.Thursday, label: 'T', full: 'Thursday' },
  { day: Weekday.Friday, label: 'F', full: 'Friday' },
  { day: Weekday.Saturday, label: 'S', full: 'Saturday' },
  { day: Weekday.Sunday, label: 'S', full: 'Sunday' },
];

export function WeekdayChips({
  days,
  onChange,
  legend = 'Repeat on',
}: {
  days: Set<Weekday>;
  onChange: (days: Set<Weekday>) => void;
  legend?: string;
}) {
  function toggle(day: Weekday) {
    const next = new Set(days);
    if (next.has(day)) next.delete(day);
    else next.add(day);
    onChange(next);
  }

  return (
    <fieldset className="weekday-chips">
      <legend className="visually-hidden">{legend}</legend>
      {DAYS.map(({ day, label, full }) => (
        <button
          key={full}
          type="button"
          className="weekday-chip"
          aria-pressed={days.has(day)}
          aria-label={full}
          onClick={() => toggle(day)}
        >
          {label}
        </button>
      ))}
    </fieldset>
  );
}
