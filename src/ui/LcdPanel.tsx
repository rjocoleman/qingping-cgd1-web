import { useEffect, useState } from 'preact/hooks';
import { alarms, connectionState, device, sensor, settings } from '../state/store';

function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}

function formatClockDigits(now: Date, use24h: boolean): string {
  let hour = now.getHours();
  if (!use24h) {
    hour = hour % 12;
    if (hour === 0) hour = 12;
  }
  return `${pad2(hour)}:${pad2(now.getMinutes())}`;
}

function statusLabel(state: string): string {
  switch (state) {
    case 'connected':
      return 'Connected';
    case 'connecting':
      return 'Connecting';
    case 'authenticating':
      return 'Authenticating';
    default:
      return 'Disconnected';
  }
}

export function LcdPanel() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const state = connectionState.value;
  const isConnected = state === 'connected';
  const use24h = settings.value?.timeFormat24h ?? true;
  const digits = formatClockDigits(now, use24h);
  const [hourPart, minutePart] = digits.split(':') as [string, string];

  const armed = Boolean(settings.value?.alarmsEnabled && alarms.value.some((a) => a.enabled));
  const dev = device.value;

  const temperature = isConnected ? sensor.value.temperature : null;
  const humidity = isConnected ? sensor.value.humidity : null;
  const unitCelsius = settings.value?.unitCelsius ?? true;
  const temperatureLabel =
    temperature === null
      ? '--°'
      : `${unitCelsius ? temperature.toFixed(1) : ((temperature * 9) / 5 + 32).toFixed(1)}°${unitCelsius ? 'C' : 'F'}`;
  const humidityLabel = humidity === null ? '--%' : `${humidity.toFixed(0)}%RH`;

  return (
    <div
      className={`lcd-panel${isConnected ? ' lcd-panel--connected' : ''}${armed ? ' lcd-panel--armed' : ''}`}
    >
      <div className="lcd-panel__top">
        <span className="lcd-panel__status">
          {statusLabel(state)}
          {dev?.name ? <span className="lcd-panel__device-name"> · {dev.name}</span> : null}
          <span className="lcd-panel__alarm-dot" aria-hidden="true" />
        </span>
      </div>
      <div className="lcd-panel__display" aria-live="polite">
        <div className="lcd-panel__digits-ghost" aria-hidden="true">
          88:88
        </div>
        {isConnected && (
          <div className="lcd-panel__digits-lit">
            {hourPart}
            <span className="lcd-panel__colon">:</span>
            {minutePart}
          </div>
        )}
      </div>
      <div className="lcd-panel__minors">
        <span>{temperatureLabel}</span>
        <span>{humidityLabel}</span>
      </div>
    </div>
  );
}
