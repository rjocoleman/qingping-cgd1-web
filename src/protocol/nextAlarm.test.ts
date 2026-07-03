import { describe, expect, it } from 'vitest';
import { nextAlarm } from './nextAlarm';
import type { Alarm } from './types';
import { emptyAlarm, Weekday } from './types';

// +12h fixed offset (matches a +720 minute device tz). 2026-07-01 is a Wednesday.
// Model in local time by constructing dates directly (no explicit tzinfo in
// JS Date), matching the plan's "operate in local time" instruction.
const NOW = new Date(2026, 6, 1, 8, 0);

function oneShot(hour: number, minute: number, enabled = true): Alarm {
  return { enabled, hour, minute, days: new Set(), snooze: false };
}

function weekly(hour: number, minute: number, days: Set<Weekday>): Alarm {
  return { enabled: true, hour, minute, days, snooze: false };
}

describe('nextAlarm', () => {
  it('returns null when no alarms are enabled', () => {
    const alarms = [emptyAlarm(), oneShot(7, 0, false)];
    expect(nextAlarm(alarms, NOW)).toBeNull();
  });

  it('fires a one-shot alarm later today', () => {
    expect(nextAlarm([oneShot(9, 30)], NOW)).toEqual(new Date(2026, 6, 1, 9, 30));
  });

  it('rolls a passed one-shot alarm to tomorrow', () => {
    expect(nextAlarm([oneShot(7, 0)], NOW)).toEqual(new Date(2026, 6, 2, 7, 0));
  });

  it('crosses the week boundary for a weekday alarm', () => {
    // From Wednesday, the next Monday 06:00 is five days ahead.
    const monday = weekly(6, 0, new Set([Weekday.Monday]));
    expect(nextAlarm([monday], NOW)).toEqual(new Date(2026, 6, 6, 6, 0));
  });

  it("waits a week when today's weekday alarm has already passed", () => {
    const wednesday = weekly(6, 0, new Set([Weekday.Wednesday]));
    expect(nextAlarm([wednesday], NOW)).toEqual(new Date(2026, 6, 8, 6, 0));
  });

  it('fires today when the weekday alarm has not passed yet', () => {
    const wednesday = weekly(9, 30, new Set([Weekday.Wednesday]));
    expect(nextAlarm([wednesday], NOW)).toEqual(new Date(2026, 6, 1, 9, 30));
  });

  it('treats an exact time match as already fired', () => {
    const alarm = oneShot(8, 0);
    expect(nextAlarm([alarm], NOW)).toEqual(new Date(2026, 6, 2, 8, 0));
  });

  it('returns the sooner of two alarms', () => {
    const soon = oneShot(9, 30);
    const later = weekly(6, 0, new Set([Weekday.Monday]));
    expect(nextAlarm([later, soon], NOW)).toEqual(new Date(2026, 6, 1, 9, 30));
  });
});
