/**
 * GitHub OAuth — Device Flow.
 *
 * Why device flow? It does not require a client_secret, which is essential
 * for a public mobile app (we cannot ship the secret in the bundle).
 *
 * Flow:
 *   1. POST /login/device/code → get a `device_code`, a `user_code`
 *      and a `verification_uri` (https://github.com/login/device).
 *   2. We open the verification URL in the system browser, the user types
 *      the user_code on github.com.
 *   3. While the user authorises, we poll
 *      POST /login/oauth/access_token until we get an `access_token`.
 *   4. We GET /user with that token to read the profile.
 *
 * Refs: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#device-flow
 */

import * as WebBrowser from 'expo-web-browser';
import { GITHUB_CONFIG } from '../config/github';

const DEVICE_CODE_URL = 'https://github.com/login/device/code';
const TOKEN_URL = 'https://github.com/login/oauth/access_token';
const USER_URL = 'https://api.github.com/user';
const USER_EMAILS_URL = 'https://api.github.com/user/emails';

/**
 * Start step 1: ask GitHub for a device_code + user_code.
 * Returns: { device_code, user_code, verification_uri, expires_in, interval }
 */
export async function requestDeviceCode() {
  const body = new URLSearchParams({
    client_id: GITHUB_CONFIG.clientId,
    scope: GITHUB_CONFIG.scopes.join(' '),
  });

  const res = await fetch(DEVICE_CODE_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GitHub device code error: ${res.status} ${text}`);
  }

  return res.json();
}

/**
 * Poll for the token. Resolves with the access_token once the user authorises,
 * rejects if the user denies or the device_code expires.
 *
 * @param {string} deviceCode  — from requestDeviceCode()
 * @param {number} interval    — seconds, given by GitHub (usually 5)
 * @param {number} expiresIn   — seconds, given by GitHub (usually 900)
 * @param {() => boolean} cancelled — optional callback to abort
 */
export async function pollForToken({ deviceCode, interval = 5, expiresIn = 900, cancelled }) {
  const start = Date.now();
  // GitHub asks for "slow_down" if we poll too fast — bump the interval.
  let curInterval = interval;

  while (Date.now() - start < expiresIn * 1000) {
    if (cancelled && cancelled()) {
      throw new Error('cancelled');
    }
    await wait(curInterval * 1000);

    const body = new URLSearchParams({
      client_id: GITHUB_CONFIG.clientId,
      device_code: deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    });

    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    const data = await res.json().catch(() => ({}));

    if (data.access_token) {
      return data.access_token;
    }
    if (data.error === 'authorization_pending') {
      // user has not entered the code yet — keep polling
      continue;
    }
    if (data.error === 'slow_down') {
      curInterval += 5;
      continue;
    }
    if (data.error === 'expired_token') {
      throw new Error('expired_token');
    }
    if (data.error === 'access_denied') {
      throw new Error('access_denied');
    }
    // Unknown error → bail
    throw new Error(data.error || 'github_oauth_failed');
  }

  throw new Error('expired_token');
}

/** Fetch the authenticated GitHub user profile. */
export async function fetchUser(accessToken) {
  const res = await fetch(USER_URL, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub /user failed: ${res.status}`);
  }
  const u = await res.json();

  // Email is private by default — try /user/emails for the primary verified one.
  let email = u.email;
  if (!email) {
    try {
      const r2 = await fetch(USER_EMAILS_URL, {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (r2.ok) {
        const emails = await r2.json();
        const primary = emails.find((e) => e.primary && e.verified) || emails[0];
        if (primary) email = primary.email;
      }
    } catch {
      // ignore
    }
  }

  return {
    id: String(u.id),
    login: u.login,
    name: u.name || u.login,
    avatar_url: u.avatar_url,
    email: email || null,
    provider: 'github',
  };
}

/**
 * Open the GitHub verification page in the system browser so the user can
 * enter the user_code displayed in the app.
 */
export async function openVerificationPage(verificationUri) {
  try {
    await WebBrowser.openBrowserAsync(verificationUri);
  } catch {
    // ignore — the user can still type the URL manually
  }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
