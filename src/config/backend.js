/**
 * Blade Runner backend endpoint.
 *
 * Selon où tu lances l'app :
 *   - Simulateur iOS  → http://localhost:8080
 *   - Émulateur Android → http://10.0.2.2:8080  (alias docker host)
 *   - Device physique  → http://<IP_LOCAL_DU_MAC>:8080 (ex: 192.168.1.42:8080)
 *
 * Le token est optionnel pour `GET /metrics` (auth marquée Optional côté backend),
 * obligatoire pour `POST /metrics` qui est utilisé par le runner — pas par le mobile.
 */

import { Platform } from 'react-native';

// Override here when testing on a real device:
//   export const BACKEND_URL = 'http://192.168.1.42:8080';
const LOCAL_URL =
  Platform.OS === 'android' ? 'http://10.0.2.2:8080' : 'http://localhost:8080';

export const BACKEND_CONFIG = {
  url: LOCAL_URL,
  // Bearer (optional for GET /metrics — fill in if you want to secure reads later)
  token: '',
  // Per-request timeout (ms). The backend can be slow on the first scan.
  timeoutMs: 8000,
};

export const isBackendConfigured = () =>
  typeof BACKEND_CONFIG.url === 'string' && BACKEND_CONFIG.url.length > 0;
