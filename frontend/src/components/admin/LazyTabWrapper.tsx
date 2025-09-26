import React, { useEffect, useState } from 'react';

interface LazyTabWrapperProps {
  children: React.ReactNode;
  isActive: boolean;
  loadOnce?: boolean; // If true, only loads data once. If false, loads every time tab becomes active
}

export const LazyTabWrapper: React.FC<LazyTabWrapperProps> = ({
  children,
  isActive,
  loadOnce = true
}) => {
  const [hasLoaded, setHasLoaded] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (isActive && (!hasLoaded || !loadOnce)) {
      setShouldRender(true);
      if (loadOnce) {
        setHasLoaded(true);
      }
    }
  }, [isActive, hasLoaded, loadOnce]);

  // Don't render children until the tab has been activated at least once
  if (!shouldRender) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return <>{children}</>;
};