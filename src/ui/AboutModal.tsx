import { setSeenAbout } from '../state/prefs';
import { showAbout } from '../state/store';
import { Modal } from './Modal';
import { REPO_URL } from './meta';

function dismiss(): void {
  setSeenAbout();
  showAbout.value = false;
}

export function AboutModal() {
  return (
    <Modal titleId="about-title" onClose={dismiss}>
      <h2 id="about-title">Qingping CGD1 clock control</h2>
      <p className="caption">
        Control a Qingping CGD1 "Dove" Bluetooth alarm clock straight from your browser - alarms,
        settings, and ringtones, with no app, cloud, or account. Not affiliated with Qingping.
      </p>
      <p className="caption">
        It needs Chrome or Edge, on desktop or Android. Safari and Firefox don't support Web
        Bluetooth. Your clock's pairing code is stored only in this browser.
      </p>
      <p className="caption">
        Reverse-engineered and open source.{' '}
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
          Source and details on GitHub
        </a>
        .
      </p>
      <div className="cluster" style={{ marginTop: 16 }}>
        <button type="button" className="btn btn--primary" onClick={dismiss}>
          Got it
        </button>
      </div>
    </Modal>
  );
}
