/**
 * GitHub OAuth configuration.
 *
 * Replace `clientId` with the Client ID of your GitHub OAuth App
 * (https://github.com/settings/developers → New OAuth App).
 *
 * IMPORTANT: enable "Device flow" in the OAuth App settings.
 *
 * Never put the client_secret here — the device flow does not need it,
 * and a mobile bundle can be inspected.
 */

export const GITHUB_CONFIG = {
  clientId: 'Ov23linqhypf3zzRvUsH',
  // Scopes requested. `read:user` + `user:email` is the minimum to identify the user.
  // Add `repo` if you want to access private repositories of the user.
  scopes: ['read:user', 'user:email', 'repo'],
};

/** True if a real OAuth flow can be attempted. */
export const isGithubConfigured = () =>
  typeof GITHUB_CONFIG.clientId === 'string' && GITHUB_CONFIG.clientId.length > 0;
