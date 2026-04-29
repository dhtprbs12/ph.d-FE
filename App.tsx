import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider } from './src/context/AppContext';
import { RootNavigator } from './src/navigation';
import { OfflineBanner } from './src/components/common/OfflineBanner';

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <OfflineBanner />
        <RootNavigator />
        <StatusBar style="auto" />
      </AppProvider>
    </SafeAreaProvider>
  );
}
