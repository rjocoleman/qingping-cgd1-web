import { describe, expect, it } from 'vitest';
import { parseConnectedSensor, parseFirmware } from './codec';

function hex(s: string): Uint8Array {
  return Uint8Array.from(s.match(/.{2}/g)?.map((b) => Number.parseInt(b, 16)) ?? []);
}

describe('parseConnectedSensor', () => {
  it('parses temperature and humidity at /100 scale', () => {
    // temp 2350 (-> 23.5), humidity 4550 (-> 45.5).
    const reading = parseConnectedSensor(hex('002e09c611'));
    expect(reading.temperature).toBe(23.5);
    expect(reading.humidity).toBe(45.5);
    expect(reading.battery).toBeNull();
  });

  it('treats temperature as signed', () => {
    // temp -1250 (0xfb1e LE 1e fb) -> -12.5.
    expect(parseConnectedSensor(hex('001efbc611')).temperature).toBe(-12.5);
  });

  it('pins the /100 scale (not /10, which is the advertisement-only divisor)', () => {
    const reading = parseConnectedSensor(hex('002e09c611'));
    expect(reading.temperature).toBe(23.5);
    expect(reading.temperature).not.toBe(235.0);
  });

  it('rejects the wrong prefix', () => {
    expect(() => parseConnectedSensor(hex('992e09c611'))).toThrow();
  });

  it('rejects a short frame', () => {
    expect(() => parseConnectedSensor(hex('002e'))).toThrow();
  });
});

describe('parseFirmware', () => {
  it('decodes an ASCII firmware string', () => {
    const version = '1.0.1_0130';
    const bytes = new TextEncoder().encode(version);
    const frame = new Uint8Array([0x0b, bytes.length, ...bytes]);
    expect(parseFirmware(frame)).toBe(version);
  });
});
