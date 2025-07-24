interface ErrorDisplayProps {
  error: string;
  onRetry?: () => void;
  icon?: string;
  bgColor?: string;
}

export default function ErrorDisplay({ 
  error, 
  onRetry, 
  icon = "⚠️",
  bgColor = "from-red-50 to-pink-100"
}: ErrorDisplayProps) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-2xl p-6 mt-6">
      <div className="flex items-start">
        <div className="text-red-400 text-2xl mr-3">{icon}</div>
        <div className="flex-1">
          <h3 className="text-sm font-medium text-red-800 mb-2">Error</h3>
          <div className="text-sm text-red-700 mb-4">{error}</div>
          {onRetry && (
            <button
              onClick={onRetry}
              className="inline-flex items-center px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Try Again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}