import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppProvider } from './src/context/AppContext';
import { PetPhotoPickerProvider } from './src/context/PetPhotoPickerProvider';
import { ToastProvider } from './src/components/common/Toast';
import { RootNavigator } from './src/navigation';
import { OfflineBanner } from './src/components/common/OfflineBanner';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppProvider>
          <PetPhotoPickerProvider>
            <ToastProvider>
              <OfflineBanner />
              <RootNavigator />
              <StatusBar style="auto" />
            </ToastProvider>
          </PetPhotoPickerProvider>
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
