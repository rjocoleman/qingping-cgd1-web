import { errorBanner } from '../state/store';

export function ErrorBanner() {
  const banner = errorBanner.value;
  if (!banner) return null;

  return (
    <div className="error-banner" role="alert">
      <span className="error-banner__message">{banner.message}</span>
      <div className="cluster">
        {banner.retry && (
          <button
            type="button"
            className="btn btn--small"
            onClick={() => {
              errorBanner.value = null;
              banner.retry?.();
            }}
          >
            Retry
          </button>
        )}
        <button
          type="button"
          className="btn btn--small btn--ghost"
          onClick={() => {
            errorBanner.value = null;
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
