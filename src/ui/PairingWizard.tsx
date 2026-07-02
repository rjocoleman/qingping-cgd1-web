import { useState } from 'preact/hooks';
import { cancelPairing, pairWithCode } from '../state/actions';
import { generateTokenHex, groupHex, isValidTokenHex } from '../state/hex';
import { pairingAuthRejected, pairingBusy, pairingDevice, pairingError } from '../state/store';

type CodeSource = 'new' | 'existing';

export function PairingWizard() {
  // Generate the new code once so it stays stable while the panel is open;
  // the user can copy it to reuse the same binding in Home Assistant later.
  const [newCode, setNewCode] = useState(generateTokenHex);
  const [source, setSource] = useState<CodeSource>('new');
  const [existingCode, setExistingCode] = useState('');

  const dev = pairingDevice.value;
  const busy = pairingBusy.value;
  const rejected = pairingAuthRejected.value;
  const error = pairingError.value;

  const activeCode = source === 'new' ? newCode : existingCode;
  const canPair = !busy && isValidTokenHex(activeCode);

  return (
    <div className="modal-backdrop">
      {/* biome-ignore lint/a11y/useSemanticElements: styled modal card, not a native <dialog> */}
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="pairing-title">
        <h2 id="pairing-title">Pair {dev?.name ?? 'this clock'}</h2>

        <p className="caption">
          Hold the button on top of the clock until the Bluetooth icon flashes, then pick a code and
          pair.
        </p>

        {rejected && error && (
          <p className="error-banner" role="alert">
            <span className="error-banner__message">{error}</span>
          </p>
        )}

        <fieldset className="wizard-choice">
          <legend className="section-label">Pairing code</legend>

          <label className="wizard-radio">
            <input
              type="radio"
              name="code-source"
              checked={source === 'new'}
              onChange={() => setSource('new')}
            />
            <span>
              <span className="wizard-radio__title">Create a new code</span>
              <span className="caption">For a clock you have just reset.</span>
            </span>
          </label>

          {source === 'new' && (
            <div className="wizard-code">
              <span className="mono">{groupHex(newCode)}</span>
              <button
                type="button"
                className="btn btn--small"
                disabled={busy}
                onClick={() => setNewCode(generateTokenHex())}
              >
                Regenerate
              </button>
            </div>
          )}

          <label className="wizard-radio">
            <input
              type="radio"
              name="code-source"
              checked={source === 'existing'}
              onChange={() => setSource('existing')}
            />
            <span>
              <span className="wizard-radio__title">Use an existing code</span>
              <span className="caption">Paste the token from Home Assistant or another app.</span>
            </span>
          </label>

          {source === 'existing' && (
            <input
              id="existing-code"
              type="text"
              className="mono"
              value={existingCode}
              placeholder="00112233445566778899aabbccddeeff"
              aria-label="Existing pairing code, 32 hex characters"
              onInput={(e) => setExistingCode((e.target as HTMLInputElement).value)}
            />
          )}
        </fieldset>

        {error && !rejected && <p className="caption">{error}</p>}

        <div className="cluster" style={{ marginTop: 16 }}>
          <button
            type="button"
            className="btn btn--primary"
            disabled={!canPair}
            onClick={() => void pairWithCode(activeCode)}
          >
            {busy ? 'Pairing…' : 'Pair'}
          </button>
          <button type="button" className="btn btn--ghost" disabled={busy} onClick={cancelPairing}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
