import { useState } from 'preact/hooks';
import { cancelPairing, pairAsFreshClock, pairByAdoptingToken } from '../state/actions';
import { pairingAuthRejected, pairingBusy, pairingDevice, pairingError } from '../state/store';

export function PairingWizard() {
  const [tokenInput, setTokenInput] = useState('');
  const [showAdopt, setShowAdopt] = useState(false);
  const dev = pairingDevice.value;
  const busy = pairingBusy.value;
  const rejected = pairingAuthRejected.value;
  const error = pairingError.value;

  return (
    <div className="modal-backdrop">
      {/* biome-ignore lint/a11y/useSemanticElements: styled modal card, not a native <dialog> */}
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="pairing-title">
        <h2 id="pairing-title">Pair {dev?.name ?? 'this clock'}</h2>

        {rejected && (
          <p className="error-banner" role="alert">
            <span className="error-banner__message">{error}</span>
          </p>
        )}

        {!showAdopt && (
          <>
            <div className="wizard-option">
              <div className="wizard-option__title">This clock is freshly reset</div>
              <p className="caption">
                Hold the button on top until the Bluetooth icon flashes, then pair here.
              </p>
              <button
                type="button"
                className="btn btn--primary"
                disabled={busy}
                onClick={() => void pairAsFreshClock()}
              >
                Pair a clock
              </button>
            </div>

            <div className="wizard-option">
              <div className="wizard-option__title">Adopt an existing pairing</div>
              <p className="caption">
                Paste the token from the Home Assistant integration or another app.
              </p>
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => setShowAdopt(true)}
              >
                Adopt an existing pairing
              </button>
            </div>
          </>
        )}

        {showAdopt && (
          <div className="wizard-option">
            <div className="wizard-option__title">Adopt an existing pairing</div>
            <label htmlFor="adopt-token-input" className="caption">
              Token (32 hex characters)
            </label>
            <div className="stack">
              <input
                id="adopt-token-input"
                type="text"
                className="mono"
                value={tokenInput}
                placeholder="00112233445566778899aabbccddeeff"
                onInput={(e) => setTokenInput((e.target as HTMLInputElement).value)}
              />
              <div className="cluster">
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={busy}
                  onClick={() => void pairByAdoptingToken(tokenInput)}
                >
                  Adopt and connect
                </button>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setShowAdopt(false)}
                >
                  Back
                </button>
              </div>
            </div>
          </div>
        )}

        {error && !rejected && <p className="caption">{error}</p>}

        <div className="cluster" style={{ marginTop: 16 }}>
          <button type="button" className="btn btn--ghost" onClick={cancelPairing}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
