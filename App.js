/**
 * Main Application Component
 * Integrates all components and services for the Code Review Mobile App
 */

import React from 'react';
import { StatusBar, LogBox, ActivityIndicator, View, StyleSheet } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { AppProvider, useAuth } from './src/services/context';
import { ThemeProvider, useTheme } from './src/services/theme';
import './src/utils/i18n';

// Import screens
import AuthScreen from './src/screens/AuthScreen';
import HomeScreen from './src/screens/HomeScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import PullRequestScreen from './src/screens/PullRequestScreen';

// Ignore specific warnings
LogBox.ignoreLogs([
  'Reanimated 2',
  'AsyncStorage has been extracted',
]);

// Create navigators
const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Custom theme with dark mode support
const customDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: '#64B5F6',
    background: '#1E1E1E',
    card: '#252526',
    text: '#FFFFFF',
    border: '#333333',
  },
};

const customLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#1976D2',
    background: '#F5F5F7',
    card: '#FFFFFF',
    text: '#1A1A1A',
    border: '#E0E0E0',
  },
};

// Tab navigator for main app screens
const MainTabs = () => {
  const { isDark, colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Home') {
            iconName = 'dashboard';
          } else if (route.name === 'Profile') {
            iconName = 'person';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: isDark ? '#999999' : '#757575',
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: 'Pull requests' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'Profil' }}
      />
    </Tab.Navigator>
  );
};

// Main navigation structure
const Navigation = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const { isDark, colors, ready: themeReady } = useTheme();

  // Show loading indicator while checking authentication
  if (isLoading || !themeReady) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={isDark ? customDarkTheme : customLightTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          // Auth screens
          <Stack.Screen name="Auth" component={AuthScreen} />
        ) : (
          // App screens
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen
              name="PullRequest"
              component={PullRequestScreen}
              options={{ headerShown: false }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

// Inside-theme wrapper so StatusBar / loading bg can use colors.
const ThemedRoot = () => {
  const { isDark, colors } = useTheme();
  return (
    <>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.bg}
      />
      <Navigation />
    </>
  );
};

// Main App component
const App = () => {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppProvider>
            <ThemedRoot />
          </AppProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default App;
