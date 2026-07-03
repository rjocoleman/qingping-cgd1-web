import { useState } from 'preact/hooks';
import type { Alarm } from '../../protocol/types';
import { isAlarmEmpty } from '../../protocol/types';
import { deleteAlarmSlot, firstEmptyAlarmSlot, saveAlarm } from '../../state/actions';
import { alarms, connectionState, isBusy } from '../../state/store';
import { Switch } from '../components/Switch';
import { WeekdayChips } from '../components/WeekdayChips';

function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}

function timeValue(alarm: Alarm): string {
  return `${pad2(alarm.hour)}:${pad2(alarm.minute)}`;
}

function newAlarm(): Alarm {
  return { enabled: true, hour: 7, minute: 0, days: new Set(), snooze: false };
}

function AlarmEditor({
  slot,
  alarm,
  onCancel,
}: {
  slot: number;
  alarm: Alarm;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Alarm>(alarm);
  const busy = isBusy(`alarm-${slot}`);

  return (
    <div className="alarm-card">
      <div className="alarm-card__top">
        <span className="alarm-card__slot mono">Slot {slot + 1}</span>
      </div>
      <div className="stack">
        <label className="caption" htmlFor={`alarm-time-${slot}`}>
          Time
        </label>
        <input
          id={`alarm-time-${slot}`}
          type="time"
          value={timeValue(draft)}
          onInput={(e) => {
            const [hour, minute] = (e.target as HTMLInputElement).value.split(':').map(Number);
            setDraft({ ...draft, hour: hour ?? 0, minute: minute ?? 0 });
          }}
        />
        <WeekdayChips days={draft.days} onChange={(days) => setDraft({ ...draft, days })} />
        <div className="row">
          <span className="row__label">Snooze</span>
          <Switch
            checked={draft.snooze}
            label="Snooze"
            onChange={(snooze) => setDraft({ ...draft, snooze })}
          />
        </div>
        <div className="cluster">
          <button
            type="button"
            className="btn btn--primary"
            disabled={busy}
            onClick={() => {
              void saveAlarm(slot, draft).then(onCancel);
            }}
          >
            Save
          </button>
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function AlarmCard({ slot, alarm, onEdit }: { slot: number; alarm: Alarm; onEdit: () => void }) {
  const busy = isBusy(`alarm-${slot}`);
  return (
    <div className="alarm-card">
      <div className="alarm-card__top">
        <span className="alarm-card__slot mono">Slot {slot + 1}</span>
        <Switch
          checked={alarm.enabled}
          label={`Enable alarm in slot ${slot + 1}`}
          onChange={(enabled) => void saveAlarm(slot, { ...alarm, enabled })}
        />
      </div>
      <div className="alarm-card__time">{timeValue(alarm)}</div>
      <WeekdayChips days={alarm.days} readOnly legend="Days" />
      <div className="alarm-card__row">
        <span className="caption">{alarm.snooze ? 'Snooze on' : 'Snooze off'}</span>
        <div className="cluster">
          <button type="button" className="btn btn--small" onClick={onEdit} disabled={busy}>
            Edit
          </button>
          <button
            type="button"
            className="btn btn--small btn--danger"
            disabled={busy}
            onClick={() => void deleteAlarmSlot(slot)}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export function AlarmsTab() {
  const [editingSlot, setEditingSlot] = useState<number | null>(null);
  const isConnected = connectionState.value === 'connected';
  const slots = alarms.value;
  const setSlots = slots
    .map((alarm, slot) => ({ alarm, slot }))
    .filter(({ alarm }) => !isAlarmEmpty(alarm));
  const canAdd = firstEmptyAlarmSlot() !== null;

  if (!isConnected) {
    return <p className="empty-state">Connect to a clock to manage alarms.</p>;
  }

  return (
    <div>
      {setSlots.length === 0 && editingSlot === null && (
        <p className="empty-state">No alarms set. Add one below.</p>
      )}

      {setSlots.map(({ alarm, slot }) =>
        editingSlot === slot ? (
          <AlarmEditor key={slot} slot={slot} alarm={alarm} onCancel={() => setEditingSlot(null)} />
        ) : (
          <AlarmCard key={slot} slot={slot} alarm={alarm} onEdit={() => setEditingSlot(slot)} />
        ),
      )}

      {editingSlot !== null && !setSlots.some(({ slot }) => slot === editingSlot) && (
        <AlarmEditor slot={editingSlot} alarm={newAlarm()} onCancel={() => setEditingSlot(null)} />
      )}

      {canAdd && editingSlot === null && (
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => {
            const slot = firstEmptyAlarmSlot();
            if (slot !== null) setEditingSlot(slot);
          }}
        >
          Add alarm
        </button>
      )}
    </div>
  );
}
