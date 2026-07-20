/**
 * Context Provider for the Code Review Application
 * Manages global state and provides access to services throughout the app
 */

import React, { createContext, useState, useEffect, useContext } from 'react';
import AuthService from './auth';
import StorageService from './storage';

// Create contexts
const AuthContext = createContext();
const SettingsContext = createContext();

/**
 * Authentication Provider
 * Manages user authentication state
 */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // Initialize authentication state
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Check if user is authenticated
        const authStatus = await AuthService.isAuthenticated();
        setIsAuthenticated(authStatus);
        
        if (authStatus) {
          // Get current user data
          const userData = await AuthService.getCurrentUser();
          setUser(userData);
        }
      } catch (error) {
        console.error('Error initializing auth state:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    initAuth();
  }, []);
  
  /**
   * Real GitHub OAuth via Device Flow.
   *  - If GITHUB_CONFIG.clientId is set → real flow (returns { type:'device', userCode, verificationUri, completion })
   *    The caller (AuthScreen) shows the user_code, opens the browser,
   *    and awaits `completion` to actually finalize the login.
   *  - If not configured → throws an error.
   */
  const loginWithGithub = async () => {
    const { isGithubConfigured } = await import('../config/github');

    if (!isGithubConfigured()) {
      throw new Error('GitHub OAuth non configuré.');
    }

    // Real device flow.
    const oauth = await import('./githubOAuth');
    const device = await oauth.requestDeviceCode();
    let cancelled = false;

    const completion = (async () => {
      try {
        const accessToken = await oauth.pollForToken({
          deviceCode: device.device_code,
          interval: device.interval,
          expiresIn: device.expires_in,
          cancelled: () => cancelled,
        });
        const userInfo = await oauth.fetchUser(accessToken);
        const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
        await AsyncStorage.setItem('auth_token', accessToken);
        await AsyncStorage.setItem('user_data', JSON.stringify(userInfo));
        setUser(userInfo);
        setIsAuthenticated(true);
        return userInfo;
      } catch (err) {
        // Bubble up; AuthScreen displays it.
        throw err;
      }
    })();

    return {
      type: 'device',
      userCode: device.user_code,
      verificationUri: device.verification_uri,
      expiresIn: device.expires_in,
      completion,
      cancel: () => {
        cancelled = true;
      },
    };
  };

  // Logout — purely local for an OAuth GitHub session.
  // We don't call any backend logout endpoint (none exists yet, and the
  // GitHub token cannot be revoked client-side without the client_secret).
  const logout = async () => {
    setIsLoading(true);
    try {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      await AsyncStorage.multiRemove(['auth_token', 'user_data']);
    } catch (e) {
      // ignore — we still flip state below
    } finally {
      setUser(null);
      setIsAuthenticated(false);
      setIsLoading(false);
    }
  };
  
  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated,
        loginWithGithub,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};


/**
 * Settings Provider
 * Manages user settings and preferences
 */
export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState({
    language: 'fr',
    theme: 'dark',
    notifications: true,
    codeFont: 'monospace',
    codeFontSize: 14,
    showLineNumbers: true,
    wrapLines: false,
    diffViewMode: 'split',
  });
  const [isLoading, setIsLoading] = useState(true);
  
  // Initialize settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const userSettings = await StorageService.getSettings();
        setSettings(userSettings);
      } catch (error) {
        console.error('Error loading settings:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadSettings();
  }, []);
  
  // Update settings
  const updateSettings = async (newSettings) => {
    try {
      const updatedSettings = { ...settings, ...newSettings };
      setSettings(updatedSettings);
      await StorageService.saveSettings(updatedSettings);
      return updatedSettings;
    } catch (error) {
      console.error('Error updating settings:', error);
      throw error;
    }
  };
  
  // Update a single setting
  const updateSetting = async (key, value) => {
    try {
      const updatedSettings = { ...settings, [key]: value };
      setSettings(updatedSettings);
      await StorageService.saveSettings({ [key]: value });
      return updatedSettings;
    } catch (error) {
      console.error(`Error updating setting ${key}:`, error);
      throw error;
    }
  };
  
  return (
    <SettingsContext.Provider
      value={{
        settings,
        isLoading,
        updateSettings,
        updateSetting,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

/**
 * Combined App Provider
 * Combines all providers for easy use
 */
export const AppProvider = ({ children }) => {
  return (
    <AuthProvider>
      <SettingsProvider>
        {children}
      </SettingsProvider>
    </AuthProvider>
  );
};

// Custom hooks for using contexts
export const useAuth = () => useContext(AuthContext);
export const useSettings = () => useContext(SettingsContext);
