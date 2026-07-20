import { registerRootComponent } from 'expo';
import { LogBox } from 'react-native';
import App from './App';

// Ignore specific warnings that might be caused by third-party libraries
LogBox.ignoreLogs([
  'Animated: `useNativeDriver` was not specified',
  'ViewPropTypes will be removed from React Native',
]);

// Register the main component
registerRootComponent(App);