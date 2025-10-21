import React from 'react';
import { View, Text } from 'react-native';
import { ErrorBoundary } from 'react-error-boundary';

interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

function ErrorFallback({ error, resetErrorBoundary }: ErrorFallbackProps) {
  return (
    <View className="flex-1 justify-center items-center bg-white px-6">
      <View className="mb-8">
        <Text className="text-6xl mb-4">😵</Text>
      </View>
      
      <Text className="text-2xl font-bold text-red-600 mb-4 text-center">
        Oops! Something went wrong
      </Text>
      
      <Text className="text-gray-600 text-center mb-2 text-base">
        We're sorry for the inconvenience
      </Text>
      
      <Text className="text-gray-500 text-center mb-8 text-sm px-4">
        {error.message}
      </Text>
      
      <View className="bg-blue-500 px-8 py-4 rounded-lg shadow-sm">
        <Text 
          className="text-white font-semibold text-base" 
          onPress={resetErrorBoundary}
        >
          Try Again
        </Text>
      </View>
      
      <Text className="text-gray-400 text-xs mt-6 text-center">
        If this problem persists, please contact support
      </Text>
    </View>
  );
}

interface ErrorBoundaryProviderProps {
  children: React.ReactNode;
}

export function ErrorBoundaryProvider({ children }: ErrorBoundaryProviderProps) {
  const handleError = (error: Error) => {
    console.error('ErrorBoundary caught an error:', error);
  };

  return (
    <ErrorBoundary 
      FallbackComponent={ErrorFallback}
      onError={handleError}
      onReset={() => {
        console.log('ErrorBoundary reset');
      }}
    >
      {children}
    </ErrorBoundary>
  );
}