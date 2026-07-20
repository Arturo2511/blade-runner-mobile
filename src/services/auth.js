/**
 * Minimal auth service — only reads the OAuth-stored session.
 * The real login is performed by `services/githubOAuth.js` via the
 * context's `loginWithGithub`. Logout simply clears AsyncStorage.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_TOKEN_KEY = 'auth_token';
const USER_DATA_KEY = 'user_data';

const AuthService = {
  isAuthenticated: async () => {
    try {
      const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      return !!token;
    } catch {
      return false;
    }
  },

  getCurrentUser: async () => {
    try {
      const raw = await AsyncStorage.getItem(USER_DATA_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
};

export default AuthService;
