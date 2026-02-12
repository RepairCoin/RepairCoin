'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  isChunkError: boolean;
  retryCount: number;
}

// Key for tracking chunk error retries in sessionStorage
const CHUNK_ERROR_RETRY_KEY = 'chunk_error_retry_count';
const MAX_CHUNK_RETRIES = 2;

/**
 * Check if an error is a chunk loading error
 * These happen when:
 * - New deployment with different chunk hashes
 * - User has cached old version
 * - Network timeout loading chunks
 */
function isChunkLoadError(error: Error): boolean {
  return (
    error.name === 'ChunkLoadError' ||
    error.message.includes('Loading chunk') ||
    error.message.includes('Loading CSS chunk') ||
    error.message.includes('Failed to fetch dynamically imported module')
  );
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      isChunkError: false,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    const isChunkError = isChunkLoadError(error);
    return {
      hasError: true,
      error,
      errorInfo: null,
      isChunkError
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    const isChunkError = isChunkLoadError(error);

    this.setState({
      error,
      errorInfo,
      isChunkError
    });

    // Log to error tracking service
    if (typeof window !== 'undefined') {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        isChunkError
      });

      // For chunk errors, try automatic recovery
      if (isChunkError) {
        this.handleChunkError();
      }
    }
  }

  /**
   * Handle chunk load errors by attempting automatic recovery
   * This clears caches and reloads the page
   */
  handleChunkError = () => {
    if (typeof window === 'undefined') return;

    // Get current retry count from sessionStorage
    const retryCountStr = sessionStorage.getItem(CHUNK_ERROR_RETRY_KEY);
    const retryCount = retryCountStr ? parseInt(retryCountStr, 10) : 0;

    console.log(`[ErrorBoundary] ChunkLoadError detected, retry count: ${retryCount}/${MAX_CHUNK_RETRIES}`);

    if (retryCount < MAX_CHUNK_RETRIES) {
      // Increment retry count
      sessionStorage.setItem(CHUNK_ERROR_RETRY_KEY, String(retryCount + 1));

      console.log('[ErrorBoundary] Attempting automatic recovery...');

      // Clear Next.js cache and reload
      // Adding timestamp to bust any CDN/browser caches
      const url = new URL(window.location.href);
      url.searchParams.set('_refresh', Date.now().toString());

      // Small delay to ensure state is saved
      setTimeout(() => {
        window.location.href = url.toString();
      }, 100);
    } else {
      // Max retries reached, clear the counter and show error UI
      console.log('[ErrorBoundary] Max retries reached, showing error UI');
      sessionStorage.removeItem(CHUNK_ERROR_RETRY_KEY);
      this.setState({ retryCount });
    }
  };

  /**
   * Manual refresh that clears all caches
   */
  handleHardRefresh = () => {
    if (typeof window === 'undefined') return;

    // Clear sessionStorage retry counter
    sessionStorage.removeItem(CHUNK_ERROR_RETRY_KEY);

    // Clear caches if available
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => {
          caches.delete(name);
        });
      });
    }

    // Force reload bypassing cache
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { isChunkError, error } = this.state;

      // Chunk error - auto-redirect to home instead of showing modal
      // This provides a better UX than showing an "Update Available" message
      if (isChunkError) {
        if (typeof window !== 'undefined') {
          console.log('[ErrorBoundary] ChunkLoadError - auto-redirecting to home');
          sessionStorage.removeItem(CHUNK_ERROR_RETRY_KEY);
          // Redirect to home page after a brief delay
          setTimeout(() => {
            window.location.href = '/';
          }, 100);
        }
        // Show minimal loading while redirecting
        return (
          <div className="min-h-screen flex items-center justify-center bg-[#0D0D0D]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FFCC00] mx-auto mb-4"></div>
              <p className="text-gray-400">Refreshing...</p>
            </div>
          </div>
        );
      }

      // Default error UI for non-chunk errors
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full p-6 bg-white rounded-lg shadow-lg">
            <div className="text-center">
              <div className="text-6xl mb-4">⚠️</div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Oops! Something went wrong
              </h1>
              <p className="text-gray-600 mb-6">
                We're sorry for the inconvenience. Please try refreshing the page.
              </p>

              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="text-left mb-4">
                  <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                    Error details (development only)
                  </summary>
                  <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto">
                    {this.state.error.toString()}
                    {this.state.errorInfo && this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}

              <div className="space-y-2">
                <button
                  onClick={() => window.location.reload()}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
                >
                  Refresh Page
                </button>
                <button
                  onClick={() => {
                    this.setState({ hasError: false, error: null, errorInfo: null, isChunkError: false, retryCount: 0 });
                  }}
                  className="w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook for error handling in functional components
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  const captureError = React.useCallback((error: Error) => {
    setError(error);
  }, []);

  return { resetError, captureError };
}