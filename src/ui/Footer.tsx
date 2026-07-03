import { showAbout } from '../state/store';
import { APP_COMMIT, APP_VERSION, COMMIT_URL, REPO_URL } from './meta';

export function Footer() {
  const version = `v${APP_VERSION} (${APP_COMMIT})`;
  return (
    <footer className="app-footer">
      <button
        type="button"
        className="link-button"
        onClick={() => {
          showAbout.value = true;
        }}
      >
        About
      </button>
      <span aria-hidden="true">·</span>
      <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
        GitHub
      </a>
      <span aria-hidden="true">·</span>
      <a href={COMMIT_URL} target="_blank" rel="noopener noreferrer">
        {version}
      </a>
    </footer>
  );
}
