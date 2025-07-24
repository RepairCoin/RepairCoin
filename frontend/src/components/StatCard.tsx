interface StatCardProps {
  icon: string;
  title: string;
  value: string | number;
  subtitle?: string;
  color?: string;
  loading?: boolean;
}

export default function StatCard({ 
  icon, 
  title, 
  value, 
  subtitle, 
  color = "text-blue-600",
  loading = false 
}: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          {loading ? (
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-20 mt-2"></div>
            </div>
          ) : (
            <p className={`text-3xl font-bold ${color} mt-1`}>{value}</p>
          )}
          {subtitle && (
            <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
          )}
        </div>
        <div className="text-3xl">{icon}</div>
      </div>
    </div>
  );
}