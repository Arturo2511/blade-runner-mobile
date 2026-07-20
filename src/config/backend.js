import { Platform } from 'react-native';

const PROD_URL = 'https://bladerunner.mozzon.net';

const DEV_URL =
  Platform.OS === 'android' ? 'http://10.0.2.2:8080' : 'http://localhost:8080';

export const BACKEND_CONFIG = {
  url: __DEV__ ? DEV_URL : PROD_URL,
  token: '',
  timeoutMs: 12000,
};

export const isBackendConfigured = () =>
  typeof BACKEND_CONFIG.url === 'string' && BACKEND_CONFIG.url.length > 0;
