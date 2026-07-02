import { useState } from 'preact/hooks';
import { encodeSettings } from '../../protocol/codec';
import { adoptTokenHex, exportTokenHex, generateNewToken } from '../../state/actions';
import { groupHex, isValidTokenHex, toHex } from '../../state/hex';
import { clearFrameLog, device, frameLog, settings } from '../../state/store';

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.toLocaleTimeString([], { hour12: false })}.${d.getMilliseconds().toString().padStart(3, '0')}`;
}

export function AdvancedTab() {
  const [pasteValue, setPasteValue] = useState('');
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [generated, setGenerated] = useState<string | null>(null);

  const dev = device.value;
  const tokenHex = exportTokenHex();
  const current = settings.value;
  const entries = frameLog.value;

  async function handleCopy() {
    if (!tokenHex) return;
    try {
      await navigator.clipboard.writeText(tokenHex);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard access denied; nothing more to do
    }
  }

  async function handleAdopt() {
    setPasteError(null);
    if (!isValidTokenHex(pasteValue)) {
      setPasteError('Enter 32 hex characters (16 bytes).');
      return;
    }
    try {
      await adoptTokenHex(pasteValue);
      setPasteValue('');
    } catch {
      // the error banner above already explains what happened
    }
  }

  function handleGenerate() {
    const hex = generateNewToken();
    setGenerated(hex);
  }

  return (
    <div className="stack">
      <div className="card">
        <span className="section-label">Token</span>
        <div className="row row--column">
          <div className="token-display">
            {tokenHex ? groupHex(tokenHex) : 'No clock connected'}
          </div>
          <div className="cluster">
            <button
              type="button"
              className="btn btn--small"
              disabled={!tokenHex}
              onClick={() => void handleCopy()}
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        <div className="row row--column">
          <span className="row__label">Adopt an existing pairing</span>
          <p className="caption">Paste a 32-character hex token from another app and reconnect.</p>
          <input
            type="text"
            className="mono"
            value={pasteValue}
            placeholder="00112233445566778899aabbccddeeff"
            onInput={(e) => setPasteValue((e.target as HTMLInputElement).value)}
          />
          {pasteError && <p className="caption">{pasteError}</p>}
          <button type="button" className="btn" disabled={!dev} onClick={() => void handleAdopt()}>
            Adopt and reconnect
          </button>
        </div>

        <div className="row row--column">
          <span className="row__label">Generate a new token</span>
          <p className="caption">
            This only works after the clock is reset. Generating a new token here does not clear the
            clock's existing binding.
          </p>
          <button type="button" className="btn" disabled={!dev} onClick={handleGenerate}>
            Generate new token
          </button>
          {generated && <div className="token-display">{groupHex(generated)}</div>}
        </div>
      </div>

      <div className="card">
        <span className="section-label">Raw settings</span>
        <div className="token-display mono">
          {current ? groupHex(toHex(encodeSettings(current))) : 'No settings read yet'}
        </div>
      </div>

      <div className="card">
        <div className="row">
          <span className="section-label">Frame log</span>
          <button type="button" className="btn btn--small btn--ghost" onClick={clearFrameLog}>
            Clear
          </button>
        </div>
        <div className="frame-log">
          {entries.length === 0 ? (
            <p className="frame-log__empty">No frames yet.</p>
          ) : (
            entries
              .slice()
              .reverse()
              .map((entry) => (
                <div className="frame-log__row" key={entry.id}>
                  <span className="frame-log__ts">{formatTime(entry.ts)}</span>
                  <span className={`frame-log__dir--${entry.dir}`}>
                    {entry.dir === 'tx' ? '→' : '←'}
                  </span>
                  <span>{entry.characteristic}</span>
                  <span className="frame-log__hex">{entry.hex}</span>
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  );
}
