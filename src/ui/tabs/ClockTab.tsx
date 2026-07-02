import { useEffect, useState } from 'preact/hooks';
import { nextAlarm } from '../../protocol/nextAlarm';
import { connectFlow, disconnectFlow, syncTimeNow } from '../../state/actions';
import { getAutoSyncTime, setAutoSyncTime } from '../../state/prefs';
import { alarms, battery, connectionState, device, firmware, isBusy } from '../../state/store';
import { Switch } from '../components/Switch';

function formatWhen(date: Date): string {
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (sameDay) return `today at ${time}`;
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (date.toDateString() === tomorrow.toDateString()) return `tomorrow at ${time}`;
  return `${date.toLocaleDateString([], { weekday: 'long' })} at ${time}`;
}

export function ClockTab() {
  const [autoSync, setAutoSync] = useState(getAutoSyncTime());
  const [clockTick, setClockTick] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setClockTick(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const state = connectionState.value;
  const isConnected = state === 'connected';
  const dev = device.value;
  const connecting = state === 'connecting' || state === 'authenticating';

  const upcoming = nextAlarm(alarms.value, clockTick);

  return (
    <div className="stack">
      <div className="card">
        <div className="row">
          <span className="row__label">Connection</span>
          <div className="row__control">
            {isConnected ? (
              <button
                type="button"
                className="btn"
                onClick={() => void disconnectFlow()}
                disabled={isBusy('connect')}
              >
                Disconnect
              </button>
            ) : (
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => void connectFlow()}
                disabled={isBusy('connect')}
              >
                {connecting ? 'Connecting…' : 'Connect to a clock'}
              </button>
            )}
          </div>
        </div>
        {!isConnected && (
          <div className="row">
            <span className="caption">Clock not listed in the picker?</span>
            <button
              type="button"
              className="btn btn--small"
              onClick={() => void connectFlow({ allDevices: true })}
              disabled={isBusy('connect')}
            >
              Show all nearby devices
            </button>
          </div>
        )}
        <div className="row">
          <span className="row__label">Device</span>
          <span className="caption">{dev?.name ?? 'No clock connected'}</span>
        </div>
        <div className="row">
          <span className="row__label">Battery</span>
          <span className="caption">{battery.value === null ? '--' : `${battery.value}%`}</span>
        </div>
        <div className="row">
          <span className="row__label">Firmware</span>
          <span className="caption">{firmware.value ?? '--'}</span>
        </div>
      </div>

      <div className="card">
        <div className="row">
          <span className="row__label">Next alarm</span>
          <span className="caption">{upcoming ? formatWhen(upcoming) : 'No alarms set'}</span>
        </div>
        <div className="row">
          <span className="row__label">Time here (what sync sets)</span>
          <span className="caption mono">{clockTick.toLocaleTimeString()}</span>
        </div>
      </div>

      <div className="card">
        <div className="row">
          <span className="row__label">Sync time</span>
          <div className="row__control">
            <button
              type="button"
              className="btn"
              disabled={!isConnected || isBusy('sync-time')}
              onClick={() => void syncTimeNow()}
            >
              Sync now
            </button>
          </div>
        </div>
        <div className="row">
          <div className="row--column">
            <span className="row__label">Sync automatically on connect</span>
          </div>
          <Switch
            checked={autoSync}
            label="Sync automatically on connect"
            onChange={(checked) => {
              setAutoSync(checked);
              setAutoSyncTime(checked);
            }}
          />
        </div>
      </div>
    </div>
  );
}
