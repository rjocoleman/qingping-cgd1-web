import type { Language } from '../../protocol/types';
import {
  isNightModeOff,
  previewBeep,
  previewBrightness,
  saveSettings,
  setNightMode,
  setNightWindow,
} from '../../state/actions';
import { connectionState, settings } from '../../state/store';
import { Switch } from '../components/Switch';

function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? '-' : '+';
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${h}:${m.toString().padStart(2, '0')}`;
}

function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}

export function SettingsTab() {
  const isConnected = connectionState.value === 'connected';
  const current = settings.value;

  if (!isConnected || !current) {
    return <p className="empty-state">Connect to a clock to change settings.</p>;
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="row row--column">
          <span className="row__label">Volume</span>
          <input
            type="range"
            min={1}
            max={5}
            step={1}
            value={current.volume}
            onInput={(e) => {
              const value = Number((e.target as HTMLInputElement).value);
              void previewBeep(value);
              void saveSettings({ volume: value });
            }}
          />
          <span className="caption">Previews on the clock as you drag.</span>
        </div>
      </div>

      <div className="card">
        <div className="row row--column">
          <span className="row__label">Day brightness</span>
          <input
            type="range"
            min={0}
            max={100}
            step={10}
            value={current.dayBrightness}
            onInput={(e) => {
              const value = Number((e.target as HTMLInputElement).value);
              void previewBrightness(value);
              void saveSettings({ dayBrightness: value });
            }}
          />
          <span className="caption">Previews on the clock as you drag.</span>
        </div>
        <div className="row row--column">
          <span className="row__label">Night brightness</span>
          <input
            type="range"
            min={0}
            max={100}
            step={10}
            value={current.nightBrightness}
            onInput={(e) => {
              const value = Number((e.target as HTMLInputElement).value);
              void previewBrightness(value);
              void saveSettings({ nightBrightness: value });
            }}
          />
          <span className="caption">Previews on the clock as you drag.</span>
        </div>
        <div className="row">
          <span className="row__label">Screen light seconds</span>
          <input
            type="number"
            min={1}
            max={30}
            style={{ width: '5em' }}
            value={current.screenLightSeconds}
            onChange={(e) => {
              const value = Number((e.target as HTMLInputElement).value);
              void saveSettings({ screenLightSeconds: value });
            }}
          />
        </div>
      </div>

      <div className="card">
        <div className="row">
          <span className="row__label">Language</span>
          <select
            value={current.language}
            onChange={(e) =>
              void saveSettings({ language: (e.target as HTMLSelectElement).value as Language })
            }
          >
            <option value="en">English</option>
            <option value="zh">Chinese</option>
          </select>
        </div>
        <div className="row">
          <span className="row__label">24-hour clock</span>
          <Switch
            checked={current.timeFormat24h}
            label="24-hour clock"
            onChange={(checked) => void saveSettings({ timeFormat24h: checked })}
          />
        </div>
        <div className="row">
          <span className="row__label">Celsius</span>
          <Switch
            checked={current.unitCelsius}
            label="Celsius"
            onChange={(checked) => void saveSettings({ unitCelsius: checked })}
          />
        </div>
        <div className="row">
          <span className="row__label">Timezone offset</span>
          <div className="row__control">
            <button
              type="button"
              className="btn btn--small"
              onClick={() => void saveSettings({ tzOffsetMinutes: current.tzOffsetMinutes - 6 })}
            >
              -
            </button>
            <span className="caption mono">{formatOffset(current.tzOffsetMinutes)}</span>
            <button
              type="button"
              className="btn btn--small"
              onClick={() => void saveSettings({ tzOffsetMinutes: current.tzOffsetMinutes + 6 })}
            >
              +
            </button>
          </div>
        </div>
        <div className="row">
          <span className="row__label">Alarms</span>
          <Switch
            checked={current.alarmsEnabled}
            label="Alarms enabled"
            onChange={(checked) => void saveSettings({ alarmsEnabled: checked })}
          />
        </div>
      </div>

      <div className="card">
        <div className="row">
          <span className="row__label">Night mode</span>
          <Switch
            checked={!isNightModeOff(current)}
            label="Night mode"
            onChange={(checked) => void setNightMode(checked)}
          />
        </div>
        {!isNightModeOff(current) && (
          <>
            <div className="row">
              <span className="row__label">Starts</span>
              <input
                type="time"
                value={`${pad2(current.nightStart.hour)}:${pad2(current.nightStart.minute)}`}
                onChange={(e) => {
                  const [hour, minute] = (e.target as HTMLInputElement).value
                    .split(':')
                    .map(Number);
                  void setNightWindow({ hour: hour ?? 0, minute: minute ?? 0 }, current.nightEnd);
                }}
              />
            </div>
            <div className="row">
              <span className="row__label">Ends</span>
              <input
                type="time"
                value={`${pad2(current.nightEnd.hour)}:${pad2(current.nightEnd.minute)}`}
                onChange={(e) => {
                  const [hour, minute] = (e.target as HTMLInputElement).value
                    .split(':')
                    .map(Number);
                  void setNightWindow(current.nightStart, { hour: hour ?? 0, minute: minute ?? 0 });
                }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
