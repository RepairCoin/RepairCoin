'use client';

import React from 'react';

interface DataPoint {
  date: string;
  value: number;
  label?: string;
}

interface SimpleChartProps {
  data: DataPoint[];
  title: string;
  color: string;
  formatValue?: (value: number) => string;
  height?: number;
}

export const SimpleChart: React.FC<SimpleChartProps> = ({
  data,
  title,
  color,
  formatValue = (value) => value.toString(),
  height = 200
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h3 className="text-lg font-bold text-white mb-4">{title}</h3>
        <div 
          className="bg-gray-900 rounded-lg flex items-center justify-center"
          style={{ height: `${height}px` }}
        >
          <p className="text-gray-500">No data available</p>
        </div>
      </div>
    );
  }

  const maxValue = Math.max(...data.map(d => d.value));
  const minValue = Math.min(...data.map(d => d.value));
  const range = maxValue - minValue || 1;

  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
      <h3 className="text-lg font-bold text-white mb-4">{title}</h3>
      
      <div 
        className="relative bg-gray-900 rounded-lg p-4"
        style={{ height: `${height}px` }}
      >
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-gray-500 pr-2">
          <span>{formatValue(maxValue)}</span>
          <span>{formatValue((maxValue + minValue) / 2)}</span>
          <span>{formatValue(minValue)}</span>
        </div>
        
        {/* Chart area */}
        <div className="ml-16 h-full relative">
          {/* Grid lines */}
          <div className="absolute inset-0">
            {[0, 0.25, 0.5, 0.75, 1].map((percent) => (
              <div
                key={percent}
                className="absolute w-full border-gray-700"
                style={{
                  top: `${percent * 100}%`,
                  borderTopWidth: percent === 0 || percent === 1 ? '1px' : '0.5px'
                }}
              />
            ))}
          </div>
          
          {/* Data visualization */}
          <div className="absolute inset-0 flex items-end justify-between">
            {data.map((point, index) => {
              const heightPercent = range === 0 ? 0 : ((point.value - minValue) / range) * 100;
              const widthPercent = Math.max(100 / data.length - 2, 8); // Minimum width with spacing
              
              return (
                <div
                  key={index}
                  className="relative group"
                  style={{ width: `${widthPercent}%` }}
                >
                  {/* Bar */}
                  <div
                    className={`w-full rounded-t-sm transition-all duration-200 group-hover:opacity-80 ${color}`}
                    style={{ height: `${heightPercent}%` }}
                  />
                  
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                    <div className="bg-gray-700 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                      <div className="font-semibold">{formatValue(point.value)}</div>
                      <div className="text-gray-300">{new Date(point.date).toLocaleDateString()}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* X-axis labels */}
        <div className="absolute bottom-0 left-16 right-0 flex justify-between text-xs text-gray-500 mt-2">
          {data.length > 0 && (
            <>
              <span>{new Date(data[0].date).toLocaleDateString()}</span>
              {data.length > 2 && (
                <span>{new Date(data[Math.floor(data.length / 2)].date).toLocaleDateString()}</span>
              )}
              <span>{new Date(data[data.length - 1].date).toLocaleDateString()}</span>
            </>
          )}
        </div>
      </div>
      
      {/* Summary stats */}
      <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
        <div className="text-center">
          <p className="text-gray-400">Max</p>
          <p className="font-semibold text-white">{formatValue(maxValue)}</p>
        </div>
        <div className="text-center">
          <p className="text-gray-400">Avg</p>
          <p className="font-semibold text-white">
            {formatValue(data.reduce((sum, d) => sum + d.value, 0) / data.length)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-gray-400">Total Points</p>
          <p className="font-semibold text-white">{data.length}</p>
        </div>
      </div>
    </div>
  );
};

export default SimpleChart;