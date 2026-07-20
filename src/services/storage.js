/**
 * Storage Service for the Code Review Application
 * Handles local data persistence, caching, and offline capabilities
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

// Storage keys prefixes
const CACHE_PREFIX = 'cache_';
const OFFLINE_ACTIONS_KEY = 'offline_actions';
const SETTINGS_KEY = 'user_settings';

// Cache expiration time (24 hours in milliseconds)
const CACHE_EXPIRATION = 24 * 60 * 60 * 1000;

/**
 * Storage service with methods for data persistence
 */
const StorageService = {
  /**
   * Save data to cache with expiration
   * @param {string} key - Cache key
   * @param {any} data - Data to cache
   * @param {number} expiration - Expiration time in milliseconds (default: 24h)
   * @returns {Promise<void>}
   */
  cacheData: async (key, data, expiration = CACHE_EXPIRATION) => {
    try {
      const cacheItem = {
        data,
        expiration: Date.now() + expiration,
      };
      
      await AsyncStorage.setItem(
        `${CACHE_PREFIX}${key}`,
        JSON.stringify(cacheItem)
      );
    } catch (error) {
      console.error('Error caching data:', error);
    }
  },
  
  /**
   * Get data from cache if not expired
   * @param {string} key - Cache key
   * @returns {Promise<any|null>} Cached data or null if expired/not found
   */
  getCachedData: async (key) => {
    try {
      const cachedItem = await AsyncStorage.getItem(`${CACHE_PREFIX}${key}`);
      
      if (!cachedItem) {
        return null;
      }
      
      const { data, expiration } = JSON.parse(cachedItem);
      
      // Check if cache is expired
      if (Date.now() > expiration) {
        // Remove expired cache
        await AsyncStorage.removeItem(`${CACHE_PREFIX}${key}`);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('Error retrieving cached data:', error);
      return null;
    }
  },
  
  /**
   * Clear specific cache item
   * @param {string} key - Cache key
   * @returns {Promise<void>}
   */
  clearCache: async (key) => {
    try {
      await AsyncStorage.removeItem(`${CACHE_PREFIX}${key}`);
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  },
  
  /**
   * Clear all cached data
   * @returns {Promise<void>}
   */
  clearAllCache: async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(CACHE_PREFIX));
      
      if (cacheKeys.length > 0) {
        await AsyncStorage.multiRemove(cacheKeys);
      }
    } catch (error) {
      console.error('Error clearing all cache:', error);
    }
  },
  
  /**
   * Save an action to be performed when online
   * @param {Object} action - Action to perform when online
   * @returns {Promise<void>}
   */
  saveOfflineAction: async (action) => {
    try {
      // Get existing offline actions
      const existingActionsJson = await AsyncStorage.getItem(OFFLINE_ACTIONS_KEY);
      const existingActions = existingActionsJson ? JSON.parse(existingActionsJson) : [];
      
      // Add new action with timestamp
      const actionWithTimestamp = {
        ...action,
        timestamp: Date.now(),
      };
      
      // Save updated actions
      await AsyncStorage.setItem(
        OFFLINE_ACTIONS_KEY,
        JSON.stringify([...existingActions, actionWithTimestamp])
      );
    } catch (error) {
      console.error('Error saving offline action:', error);
      
      Alert.alert(
        'Erreur de stockage',
        'Impossible de sauvegarder l\'action pour une exécution ultérieure.',
        [{ text: 'OK' }]
      );
    }
  },
  
  /**
   * Get all pending offline actions
   * @returns {Promise<Array>} List of pending actions
   */
  getOfflineActions: async () => {
    try {
      const actionsJson = await AsyncStorage.getItem(OFFLINE_ACTIONS_KEY);
      return actionsJson ? JSON.parse(actionsJson) : [];
    } catch (error) {
      console.error('Error retrieving offline actions:', error);
      return [];
    }
  },
  
  /**
   * Clear all pending offline actions
   * @returns {Promise<void>}
   */
  clearOfflineActions: async () => {
    try {
      await AsyncStorage.removeItem(OFFLINE_ACTIONS_KEY);
    } catch (error) {
      console.error('Error clearing offline actions:', error);
    }
  },
  
  /**
   * Remove a specific offline action by ID
   * @param {string} actionId - Action ID to remove
   * @returns {Promise<void>}
   */
  removeOfflineAction: async (actionId) => {
    try {
      const actionsJson = await AsyncStorage.getItem(OFFLINE_ACTIONS_KEY);
      
      if (!actionsJson) {
        return;
      }
      
      const actions = JSON.parse(actionsJson);
      const updatedActions = actions.filter(action => action.id !== actionId);
      
      await AsyncStorage.setItem(OFFLINE_ACTIONS_KEY, JSON.stringify(updatedActions));
    } catch (error) {
      console.error('Error removing offline action:', error);
    }
  },
  
  /**
   * Check if device is online
   * @returns {Promise<boolean>} True if online
   */
  isOnline: async () => {
    try {
      const netInfo = await NetInfo.fetch();
      return netInfo.isConnected && netInfo.isInternetReachable;
    } catch (error) {
      console.error('Error checking network status:', error);
      return false;
    }
  },
  
  /**
   * Save user settings
   * @param {Object} settings - User settings
   * @returns {Promise<void>}
   */
  saveSettings: async (settings) => {
    try {
      // Get existing settings
      const existingSettingsJson = await AsyncStorage.getItem(SETTINGS_KEY);
      const existingSettings = existingSettingsJson ? JSON.parse(existingSettingsJson) : {};
      
      // Merge with new settings
      const updatedSettings = {
        ...existingSettings,
        ...settings,
      };
      
      // Save updated settings
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(updatedSettings));
    } catch (error) {
      console.error('Error saving settings:', error);
      
      Alert.alert(
        'Erreur de paramètres',
        'Impossible de sauvegarder les paramètres.',
        [{ text: 'OK' }]
      );
    }
  },
  
  /**
   * Get user settings
   * @returns {Promise<Object>} User settings
   */
  getSettings: async () => {
    try {
      const settingsJson = await AsyncStorage.getItem(SETTINGS_KEY);
      return settingsJson ? JSON.parse(settingsJson) : {
        // Default settings
        language: 'fr',
        theme: 'dark',
        notifications: true,
        codeFont: 'monospace',
        codeFontSize: 14,
        showLineNumbers: true,
        wrapLines: false,
        diffViewMode: 'split',
      };
    } catch (error) {
      console.error('Error retrieving settings:', error);
      return {};
    }
  },
  
  /**
   * Get a specific setting
   * @param {string} key - Setting key
   * @param {any} defaultValue - Default value if setting not found
   * @returns {Promise<any>} Setting value
   */
  getSetting: async (key, defaultValue = null) => {
    try {
      const settings = await StorageService.getSettings();
      return settings[key] !== undefined ? settings[key] : defaultValue;
    } catch (error) {
      console.error(`Error retrieving setting: ${key}`, error);
      return defaultValue;
    }
  },
};

export default StorageService;