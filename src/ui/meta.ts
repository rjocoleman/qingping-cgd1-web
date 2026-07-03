export const REPO_URL = 'https://github.com/rjocoleman/qingping-cgd1-web';
export const APP_VERSION = __APP_VERSION__;
export const APP_COMMIT = __APP_COMMIT__;
export const COMMIT_URL = APP_COMMIT === 'dev' ? REPO_URL : `${REPO_URL}/commit/${APP_COMMIT}`;
