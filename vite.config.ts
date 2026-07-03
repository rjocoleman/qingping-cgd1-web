import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

// Stamp the build with the current commit so the footer can link back to the
// exact source. Falls back to a CI-provided SHA, then to "dev" for a build
// outside a git checkout.
function commitRef(): string {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  } catch {
    return process.env.CF_PAGES_COMMIT_SHA?.slice(0, 7) ?? 'dev';
  }
}

export default defineConfig({
  plugins: [preact()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_COMMIT__: JSON.stringify(commitRef()),
  },
});
