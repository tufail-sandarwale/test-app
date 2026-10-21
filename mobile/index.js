/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { installGlobalErrorHandler } from './src/services/diagnostics';

installGlobalErrorHandler();

AppRegistry.registerComponent(appName, () => App);
