'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface TreasurySyncContextType {
  triggerRefresh: (component: string) => void;
  subscribeToRefresh: (component: string, callback: () => void) => () => void;
  isRefreshing: boolean;
}

const TreasurySyncContext = createContext<TreasurySyncContextType | null>(null);

export const TreasurySyncProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [subscribers, setSubscribers] = useState<Record<string, (() => void)[]>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);

  const triggerRefresh = useCallback(async (triggerComponent: string) => {
    setIsRefreshing(true);
    
    // Notify all subscribers except the triggering component
    Object.entries(subscribers).forEach(([component, callbacks]) => {
      if (component !== triggerComponent) {
        callbacks.forEach(callback => {
          try {
            callback();
          } catch (error) {
            console.error(`Error refreshing ${component}:`, error);
          }
        });
      }
    });

    // Allow time for refresh operations
    setTimeout(() => setIsRefreshing(false), 1000);
  }, [subscribers]);

  const subscribeToRefresh = useCallback((component: string, callback: () => void) => {
    setSubscribers(prev => ({
      ...prev,
      [component]: [...(prev[component] || []), callback]
    }));

    // Return unsubscribe function
    return () => {
      setSubscribers(prev => ({
        ...prev,
        [component]: (prev[component] || []).filter(cb => cb !== callback)
      }));
    };
  }, []);

  return (
    <TreasurySyncContext.Provider value={{ triggerRefresh, subscribeToRefresh, isRefreshing }}>
      {children}
    </TreasurySyncContext.Provider>
  );
};

export const useTreasurySync = () => {
  const context = useContext(TreasurySyncContext);
  if (!context) {
    throw new Error('useTreasurySync must be used within TreasurySyncProvider');
  }
  return context;
};