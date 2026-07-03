/** Next-fire computation across one-shot, weekday, and roll-forward cases. */

import type { Alarm } from './types';
import { isAlarmEmpty, Weekday } from './types';

const DAYS_IN_WEEK = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function atTime(base: Date, hour: number, minute: number): Date {
  const d = new Date(base);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

const WEEKDAY_ORDER: Weekday[] = [
  Weekday.Monday,
  Weekday.Tuesday,
  Weekday.Wednesday,
  Weekday.Thursday,
  Weekday.Friday,
  Weekday.Saturday,
  Weekday.Sunday,
];

/**
 * Find the soonest Date an alarm fires at or after `now`.
 *
 * A candidate that lands exactly on or before `now` is treated as already
 * fired, not upcoming, so it rolls forward to the next occurrence - an alarm
 * equal to the current second should not fire again immediately. Weekday
 * selection uses modulo-7 arithmetic on the day-of-week difference so that a
 * target day earlier in the week than today wraps around to next week
 * rather than producing a negative offset.
 */
function nextFire(alarm: Alarm, now: Date): Date {
  if (alarm.days.size === 0) {
    let candidate = atTime(now, alarm.hour, alarm.minute);
    if (candidate <= now) candidate = addDays(candidate, 1);
    return candidate;
  }
  // JS getDay() is Sunday-indexed (0-6); shift to Monday-indexed to match
  // the Weekday bit positions (Monday = bit 0).
  const todayMondayIndexed = (now.getDay() + 6) % DAYS_IN_WEEK;
  let soonest: Date | null = null;
  for (const day of alarm.days) {
    const targetWeekday = WEEKDAY_ORDER.indexOf(day);
    const daysAhead = (targetWeekday - todayMondayIndexed + DAYS_IN_WEEK) % DAYS_IN_WEEK;
    let candidate = atTime(addDays(now, daysAhead), alarm.hour, alarm.minute);
    if (candidate <= now) candidate = addDays(candidate, DAYS_IN_WEEK);
    if (soonest === null || candidate < soonest) soonest = candidate;
  }
  // alarm.days.size > 0 guarantees at least one iteration above.
  return soonest as Date;
}

/**
 * Next fire time of the soonest enabled alarm, or null if none are enabled.
 *
 * Roll-forward semantics: a one-shot alarm fires today if its time is still
 * ahead of `now`, otherwise tomorrow; a weekday alarm fires on the soonest
 * matching weekday and time at or after `now`.
 */
export function nextAlarm(alarms: readonly Alarm[], now: Date): Date | null {
  let soonest: Date | null = null;
  for (const alarm of alarms) {
    if (!alarm.enabled || isAlarmEmpty(alarm)) continue;
    const fire = nextFire(alarm, now);
    if (soonest === null || fire < soonest) soonest = fire;
  }
  return soonest;
}
