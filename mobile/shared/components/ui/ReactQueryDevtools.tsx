import React from 'react';
import { Platform } from 'react-native';

// Only import devtools in development and for web platform
let ReactQueryDevtools: React.ComponentType<any> | null = null;

if (__DEV__ && Platform.OS === 'web') {
  try {
    const { ReactQueryDevtools: DevtoolsComponent } = require('@tanstack/react-query-devtools');
    ReactQueryDevtools = DevtoolsComponent;
  } catch (error) {
    console.log('React Query DevTools not available');
  }
}

export const DevTools: React.FC = () => {
  if (!ReactQueryDevtools) {
    return null;
  }

  return (
    <ReactQueryDevtools
      initialIsOpen={false}
      position="bottom-right"
      panelPosition="bottom"
    />
  );
};

export default DevTools;