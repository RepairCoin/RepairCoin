interface LoadingSpinnerProps {
  icon?: string;
  title?: string;
  message?: string;
  bgColor?: string;
}

export default function LoadingSpinner({ 
  icon = "🔧", 
  title = "Loading...", 
  message = "Please wait while we load your data",
  bgColor = "from-blue-50 to-indigo-100"
}: LoadingSpinnerProps) {
  return (
    <div className={`min-h-screen flex items-center justify-center bg-gradient-to-br ${bgColor}`}>
      <div className="max-w-md w-full mx-auto p-6">
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="text-center">
            <div className="text-4xl mb-4">{icon}</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">{title}</h2>
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2 mx-auto"></div>
              <div className="space-y-3">
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded w-5/6"></div>
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-6">{message}</p>
          </div>
        </div>
      </div>
    </div>
  );
}