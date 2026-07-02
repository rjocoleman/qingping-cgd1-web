import { useState } from 'preact/hooks';
import { OFFICIAL_RINGTONES } from '../../protocol/ringtone';
import { activateRingtone, uploadCustomRingtone } from '../../state/actions';
import { MAX_RINGTONE_SECONDS, convertToDevicePcm, playPcmPreview } from '../../state/audioConvert';
import { toHex } from '../../state/hex';
import { connectionState, isBusy, settings } from '../../state/store';

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  return a.every((byte, i) => byte === b[i]);
}

export function RingtonesTab() {
  const isConnected = connectionState.value === 'connected';
  const current = settings.value;

  const [file, setFile] = useState<File | null>(null);
  const [startSeconds, setStartSeconds] = useState(0);
  const [converted, setConverted] = useState<{ pcm: Uint8Array; durationSeconds: number } | null>(
    null,
  );
  const [converting, setConverting] = useState(false);
  const [progress, setProgress] = useState<{ sent: number; total: number } | null>(null);
  const [stopPreview, setStopPreview] = useState<{ stop(): void } | null>(null);

  if (!isConnected || !current) {
    return <p className="empty-state">Connect to a clock to change the ringtone.</p>;
  }

  async function convert(nextFile: File, offset: number) {
    setConverting(true);
    try {
      const buffer = await nextFile.arrayBuffer();
      const result = await convertToDevicePcm(buffer, { startSeconds: offset });
      setConverted(result);
    } finally {
      setConverting(false);
    }
  }

  async function handleFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const nextFile = input.files?.[0] ?? null;
    setFile(nextFile);
    setConverted(null);
    setStartSeconds(0);
    if (nextFile) await convert(nextFile, 0);
  }

  function handleListen() {
    if (!converted) return;
    stopPreview?.stop();
    setStopPreview(playPcmPreview(converted.pcm));
  }

  async function handleUpload() {
    if (!converted) return;
    setProgress({ sent: 0, total: 1 });
    try {
      await uploadCustomRingtone(converted.pcm, (sent, total) => setProgress({ sent, total }));
    } finally {
      setProgress(null);
    }
  }

  const uploading = isBusy('ringtone-upload');

  return (
    <div className="stack">
      <div className="card">
        <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
          <legend className="section-label">Built-in ringtones</legend>
          {Object.entries(OFFICIAL_RINGTONES).map(([name, signature]) => {
            const active = bytesEqual(signature, current.ringtoneSignature);
            return (
              <div className="row" key={name}>
                <label className="row__label" htmlFor={`ringtone-${name}`}>
                  {name}
                </label>
                <input
                  id={`ringtone-${name}`}
                  type="radio"
                  name="ringtone"
                  checked={active}
                  onChange={() => void activateRingtone(signature)}
                />
              </div>
            );
          })}
        </fieldset>
      </div>

      <div className="card">
        <span className="section-label">Custom ringtone</span>
        <div className="row row--column">
          <label className="caption" htmlFor="ringtone-file">
            Upload an audio file (up to {MAX_RINGTONE_SECONDS} seconds is used)
          </label>
          <input id="ringtone-file" type="file" accept="audio/*" onChange={handleFileChange} />
        </div>

        {file && (
          <div className="stack">
            <div className="row row--column">
              <label className="caption" htmlFor="ringtone-start">
                Start offset (seconds)
              </label>
              <input
                id="ringtone-start"
                type="number"
                min={0}
                style={{ width: '6em' }}
                value={startSeconds}
                onChange={(e) => {
                  const value = Number((e.target as HTMLInputElement).value);
                  setStartSeconds(value);
                  void convert(file, value);
                }}
              />
            </div>

            {converting && <p className="caption">Converting…</p>}

            {converted && !converting && (
              <div className="row">
                <span className="caption">
                  {converted.durationSeconds.toFixed(1)}s · {converted.pcm.length.toLocaleString()}{' '}
                  bytes
                </span>
                <button type="button" className="btn btn--small" onClick={handleListen}>
                  Listen
                </button>
              </div>
            )}

            {progress && (
              <div className="progress">
                <div className="progress__track">
                  <div
                    className="progress__fill"
                    style={{ width: `${Math.round((progress.sent / progress.total) * 100)}%` }}
                  />
                </div>
                <span className="progress__label mono">
                  {Math.round((progress.sent / progress.total) * 100)}%
                </span>
              </div>
            )}

            <button
              type="button"
              className="btn btn--primary"
              disabled={!converted || uploading}
              onClick={() => void handleUpload()}
            >
              Upload ringtone
            </button>
          </div>
        )}
      </div>

      <p className="caption mono">
        Active signature: {toHex(current.ringtoneSignature).toUpperCase()}
      </p>
    </div>
  );
}
