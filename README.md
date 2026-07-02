# qingping-cgd1-web

Control a Qingping CGD1 "Dove" Bluetooth alarm clock from a browser. A full
replacement for the official Qingping+ app: alarms, settings, time sync, live
sensor readings, and custom ringtones, all over Web Bluetooth with no cloud
and nothing installed.

Runs in Chrome or Edge, desktop and Android. Safari and Firefox don't ship Web
Bluetooth, so the app tells you that instead of half-working.

## What it does

- All 16 alarm slots: time, days of week, snooze, enable/disable, plus a
  computed next-alarm readout.
- Every device setting: volume, day and night brightness (with live preview on
  the clock as you drag), screen light, language, 12/24 hour, C/F, timezone,
  night mode, master alarm switch.
- Time sync, automatic on connect or manual.
- Live temperature and humidity from the connected sensor stream, battery, and
  firmware version.
- Ringtones: switch between the nine built-in ones, or upload your own audio.
  Anything the browser can decode gets converted to the clock's 8-bit 8 kHz
  mono PCM format locally, with a preview of exactly what the clock will play
  (including the quality loss - it is an alarm clock speaker, not hi-fi).
- An advanced tab with token management, a raw settings dump, and a live log
  of every BLE frame in both directions.

## Pairing and tokens

The clock binds to a single 16-byte token, first come first served. A freshly
reset clock (hold the button on top until the Bluetooth icon flashes) accepts
whatever token pairs first; after that, only that token gets in.

That means this app and anything else (the Home Assistant integration, the
official app) can't each pair independently. The advanced tab handles the
interop: export the token this app holds, or paste one in to adopt an existing
pairing. Tokens live in localStorage, keyed per device.

## Development

```sh
mise install
npm install --ignore-scripts
npm run dev
```

`--ignore-scripts` sidesteps a sharp native build pulled in by wrangler that
isn't needed here. Open the dev server with `?demo` appended to drive the full
UI against a fake clock, no hardware required.

Checks: `npm run lint` (Biome), `npx tsc --noEmit`, `npm test` (Vitest).
lefthook runs all three on pre-commit once you `lefthook install`.

## Deployment

Static assets on Cloudflare Workers:

```sh
npm run build
npx wrangler deploy
```

Web Bluetooth needs HTTPS, which Workers gives you out of the box.

## Protocol

The wire protocol lives in `src/protocol/` and is ported from
[qingping-cgd1](https://github.com/rjocoleman/qingping-cgd1), a
hardware-tested Python library for the same device. Ringtone upload framing
comes from [clOwOck](https://github.com/MrBoombastic/clOwOck)'s
reverse-engineering notes (WTFPL). The related Home Assistant integration is
[ha-qingping-cgd1](https://github.com/rjocoleman/ha-alarm-clock).

## Licence

MIT. Bundled fonts (IBM Plex, DSEG7) are OFL-1.1, licences included alongside.
