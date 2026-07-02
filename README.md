# qingping-cgd1-web

Control a Qingping CGD1 "Dove" Bluetooth alarm clock from your browser. Alarms,
settings, time sync, live temperature and humidity, and custom ringtones, all
over Web Bluetooth. No app, no cloud, no account. Not affiliated with Qingping.

**Live version: [dove.rjoc.me](https://dove.rjoc.me)**

## What it does

- All 16 alarm slots: time, days of week, snooze, enable and disable, plus a
  next-alarm readout.
- Every device setting: volume, day and night brightness (previewed live on the
  clock), screen light, language, 12/24 hour, C/F, timezone, night mode, master
  alarm switch.
- Time sync, automatic on connect or manual.
- Live temperature and humidity from the connected sensor stream, battery, and
  firmware version.
- Ringtones: pick any of the nine built-ins, or upload your own audio. Anything
  the browser can decode is converted to the clock's 8-bit 8 kHz mono format
  locally, and the preview plays the converted result so you hear exactly what
  the clock will get.

## Browser support

Web Bluetooth only works in Chrome and Edge, on desktop and Android. Safari and
Firefox don't provide it, and there's no iOS support at all. The app says so
plainly if you open it in an unsupported browser.

## Pairing and codes

The clock binds to a single 16-byte code, first come first served. A freshly
reset clock (hold the button on top until the Bluetooth icon flashes) takes
whatever code pairs first; after that, only that code gets in.

Because of that, this app and anything else that talks to the clock (the
official app, a Home Assistant integration) can't each pair independently. Pick
"Create a new code" for a clock you've just reset, or "Use an existing code" to
paste a code another app already bound. The new code is shown so you can copy it
and reuse the same binding elsewhere.

Once paired, the code is saved in your browser's local storage, keyed to the
device. Next time, you pick the clock from Chrome's chooser and it reconnects
straight away, no re-pairing. Clearing site data forgets the code, so keep a
copy of anything you want to reuse.

## Self-hosting

It's a static site, so you can run it locally or host your own copy.

```sh
mise install          # node lts and lefthook, per mise.toml
npm install --ignore-scripts
npm run dev
```

`--ignore-scripts` skips a sharp native build pulled in by wrangler that this
app never uses. Open the dev server with `?demo` on the URL to drive the whole
UI against a fake clock, no hardware needed.

Deploy your own copy to Cloudflare Workers (Web Bluetooth needs HTTPS, which
Workers gives you):

```sh
npm run build
npx wrangler deploy
```

Or serve `dist/` from any static host over HTTPS.

Checks: `npm run lint` (Biome), `npm run typecheck`, `npm test` (Vitest).
lefthook runs them on pre-commit once you've run `lefthook install`.

## Protocol and credits

The CGD1 speaks a small, reverse-engineered BLE protocol with no checksums and
fixed byte layouts. This app's protocol layer (`src/protocol/`) is a TypeScript
port of the hardware-tested Python library
[qingping-cgd1](https://github.com/rjocoleman/qingping-cgd1).

The protocol itself was mapped by others, whose work this builds on:

- [MrBoombastic/clOwOck](https://github.com/MrBoombastic/clOwOck) (WTFPL), an
  Android app for the CGD1. Its notes on authentication, the GATT layout, sensor
  and alarm formats, and the ringtone upload protocol are the primary source.
- [ov1d1u/qingping_alarm_clock](https://github.com/ov1d1u/qingping_alarm_clock)
  and [vicar82/qingping_alarm_clock_fixed](https://github.com/vicar82/qingping_alarm_clock_fixed)
  (both Apache-2.0), earlier Home Assistant integrations, for confirming the
  GATT service and characteristic layout.

The related Home Assistant integration is
[ha-qingping-cgd1](https://github.com/rjocoleman/ha-alarm-clock).

## Disclaimer and trademarks

"Qingping" and "CGD1" are trademarks of their respective owners. This is an
unofficial, unaffiliated project built from reverse-engineered notes, not an
official app or SDK.

It writes settings and alarms to your clock over Bluetooth. It works and it's
tested against a real CGD1, but there's no warranty and no guarantee it won't
misbehave on a firmware version it hasn't seen. Use it at your own risk. If a
setting looks wrong, the Advanced tab has a live log of every frame sent and
received.

## How this was built

Built largely with AI assistance (Claude) and tested against a real CGD1
(firmware 1.0.1_0130). Tested and working, but a spare-time project - no
warranty, no support promises.

## Licence

MIT. Bundled fonts (IBM Plex, DSEG7) are OFL-1.1, with their licences included
alongside the font files.
