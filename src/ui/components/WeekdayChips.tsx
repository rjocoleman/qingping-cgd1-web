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
  readOnly = false,
}: {
  days: Set<Weekday>;
  onChange?: (days: Set<Weekday>) => void;
  legend?: string;
  readOnly?: boolean;
}) {
  function toggle(day: Weekday) {
    const next = new Set(days);
    if (next.has(day)) next.delete(day);
    else next.add(day);
    onChange?.(next);
  }

  if (readOnly) {
    // A summary, not a control: no focusable buttons for a card you can't edit
    // in place. The active days are named so it reads sensibly aloud.
    const active = DAYS.filter(({ day }) => days.has(day));
    const summary = active.length ? active.map((d) => d.full).join(', ') : 'One-off';
    return (
      <div className="weekday-chips" role="img" aria-label={`${legend}: ${summary}`}>
        {DAYS.map(({ day, label, full }) => (
          <span
            key={full}
            className={`weekday-chip${days.has(day) ? ' weekday-chip--on' : ''}`}
            aria-hidden="true"
            title={full}
          >
            {label}
          </span>
        ))}
      </div>
    );
  }

  return (
    <fieldset className="weekday-chips">
      <legend className="visually-hidden">{legend}</legend>
      {DAYS.map(({ day, label, full }) => (
        <button
          key={full}
          type="button"
          className={`weekday-chip${days.has(day) ? ' weekday-chip--on' : ''}`}
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
