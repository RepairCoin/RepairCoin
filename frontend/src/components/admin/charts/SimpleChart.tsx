'use client';

import React from 'react';

interface DataPoint {
  date: string;
  value: number;
  label?: string;
  category?: string;
}

interface SimpleChartProps {
  data: DataPoint[];
  title: string;
  color: string;
  formatValue?: (value: number) => string;
  height?: number;
  type?: 'bar' | 'line' | 'area';
}

interface LineChartProps {
  data: Array<{ date: string; value: number; value2?: number; label?: string }>;
  title: string;
  lines: Array<{ key: 'value' | 'value2'; color: string; label: string }>;
  formatValue?: (value: number) => string;
  height?: number;
}

interface PieChartProps {
  data: Array<{ label: string; value: number; color: string }>;
  title: string;
  formatValue?: (value: number) => string;
  size?: number;
}

// Enhanced Bar/Line Chart
export const SimpleChart: React.FC<SimpleChartProps> = ({
  data,
  title,
  color,
  formatValue = (value) => value.toString(),
  height = 200,
  type = 'bar'
}) => {
  
  if (!data || data.length === 0) {
    return (
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h3 className="text-lg font-bold text-white mb-4">{title}</h3>
        <div 
          className="bg-gray-700 rounded-lg flex items-center justify-center border border-gray-600"
          style={{ height: `${height}px` }}
        >
          <p className="text-gray-300">No data available</p>
        </div>
      </div>
    );
  }

  // Ensure values are numbers and handle potential string values
  const numericData = data.map(d => ({
    ...d,
    value: typeof d.value === 'string' ? parseFloat(d.value) || 0 : (d.value || 0)
  }));
  
  const values = numericData.map(d => d.value).filter(v => !isNaN(v));
  const maxValue = values.length > 0 ? Math.max(...values) : 100;
  const minValue = values.length > 0 ? Math.min(0, Math.min(...values)) : 0;
  const range = maxValue - minValue || 1;
  

  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
      <h3 className="text-lg font-bold text-white mb-4">{title}</h3>
      
      <div 
        className="relative bg-gray-700 rounded-lg p-4 border border-gray-600"
        style={{ height: `${height}px` }}
      >
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-gray-300 pr-2 w-12">
          <span className="bg-gray-600 px-2 py-1 rounded text-white">{formatValue(maxValue)}</span>
          <span className="bg-gray-600 px-2 py-1 rounded text-white">{formatValue((maxValue + minValue) / 2)}</span>
          <span className="bg-gray-600 px-2 py-1 rounded text-white">{formatValue(minValue)}</span>
        </div>
        
        {/* Chart area */}
        <div className="ml-14 h-full relative">
          {/* Grid lines */}
          <div className="absolute inset-0">
            {[0, 0.25, 0.5, 0.75, 1].map((percent) => (
              <div
                key={percent}
                className="absolute w-full border-gray-500"
                style={{
                  top: `${percent * 100}%`,
                  borderTopWidth: percent === 0 || percent === 1 ? '1px' : '0.5px'
                }}
              />
            ))}
          </div>
          
          {/* Data visualization */}
          {type === 'bar' ? (
            <div className="absolute inset-0 flex items-end justify-between">
              {data.map((point, index) => {
                const heightPercent = range === 0 ? 50 : Math.max(5, ((point.value - minValue) / range) * 85);
                const widthPercent = Math.max(100 / data.length - 2, 8);
                
                // Convert Tailwind color to actual color
                const getBarColor = (colorClass: string) => {
                  if (colorClass.includes('bg-blue')) return '#3B82F6';
                  if (colorClass.includes('bg-green')) return '#10B981';
                  if (colorClass.includes('bg-red')) return '#EF4444';
                  if (colorClass.includes('bg-purple')) return '#8B5CF6';
                  if (colorClass.includes('bg-indigo')) return '#6366F1';
                  if (colorClass.includes('bg-yellow')) return '#F59E0B';
                  if (colorClass.includes('bg-orange')) return '#F97316';
                  return '#6B7280'; // default gray
                };
                
                return (
                  <div
                    key={index}
                    className="relative group"
                    style={{ width: `${widthPercent}%` }}
                  >
                    <div
                      className="w-full rounded-t-sm transition-all duration-200 group-hover:opacity-80"
                      style={{ 
                        height: `${heightPercent}%`,
                        backgroundColor: getBarColor(color),
                        minHeight: '2px'
                      }}
                    />
                    
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                      <div className="bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap shadow-lg">
                        <div className="font-semibold">{formatValue(point.value)}</div>
                        <div className="text-gray-300">{point.date.length > 10 ? new Date(point.date).toLocaleDateString() : point.date}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            // Line chart
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              {(() => {
                const getStrokeColor = (colorClass: string) => {
                  if (colorClass.includes('bg-blue')) return '#3B82F6';
                  if (colorClass.includes('bg-green')) return '#10B981';
                  if (colorClass.includes('bg-red')) return '#EF4444';
                  if (colorClass.includes('bg-purple')) return '#8B5CF6';
                  if (colorClass.includes('bg-indigo')) return '#6366F1';
                  if (colorClass.includes('bg-yellow')) return '#F59E0B';
                  if (colorClass.includes('bg-orange')) return '#F97316';
                  return '#6B7280';
                };
                
                const strokeColor = getStrokeColor(color);
                const points = data.map((point, index) => {
                  const x = data.length === 1 ? 50 : (index / Math.max(data.length - 1, 1)) * 100;
                  const y = range === 0 ? 50 : 100 - Math.max(5, Math.min(95, ((point.value - minValue) / range) * 90 + 5));
                  return `${x},${y}`;
                }).join(' ');
                
                return (
                  <g>
                    <polyline
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth="2"
                      points={points}
                      vectorEffect="non-scaling-stroke"
                    />
                    {data.map((point, index) => {
                      const x = data.length === 1 ? 50 : (index / Math.max(data.length - 1, 1)) * 100;
                      const y = range === 0 ? 50 : 100 - Math.max(5, Math.min(95, ((point.value - minValue) / range) * 90 + 5));
                      return (
                        <circle
                          key={index}
                          cx={x}
                          cy={y}
                          r="2"
                          fill={strokeColor}
                          className="hover:r-3 transition-all"
                        />
                      );
                    })}
                  </g>
                );
              })()}
            </svg>
          )}
        </div>
        
        {/* X-axis labels */}
        <div className="absolute -bottom-6 left-14 right-0 flex justify-between text-xs text-gray-300">
          {data.length > 0 && (
            <>
              <span className="bg-gray-600 px-2 py-1 rounded text-white">{new Date(data[0].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              {data.length > 2 && (
                <span className="bg-gray-600 px-2 py-1 rounded text-white">{new Date(data[Math.floor(data.length / 2)].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              )}
              <span className="bg-gray-600 px-2 py-1 rounded text-white">{new Date(data[data.length - 1].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
            </>
          )}
        </div>
      </div>
      
      {/* Enhanced summary stats */}
      <div className="mt-6 grid grid-cols-4 gap-4 text-sm">
        <div className="text-center p-3 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg border border-blue-500">
          <p className="text-blue-200 text-xs">Peak</p>
          <p className="font-bold text-white">{formatValue(maxValue)}</p>
        </div>
        <div className="text-center p-3 bg-gradient-to-br from-green-600 to-green-700 rounded-lg border border-green-500">
          <p className="text-green-200 text-xs">Average</p>
          <p className="font-bold text-white">
            {formatValue(Math.round(data.reduce((sum, d) => sum + d.value, 0) / data.length))}
          </p>
        </div>
        <div className="text-center p-3 bg-gradient-to-br from-purple-600 to-purple-700 rounded-lg border border-purple-500">
          <p className="text-purple-200 text-xs">Total</p>
          <p className="font-bold text-white">{formatValue(data.reduce((sum, d) => sum + d.value, 0))}</p>
        </div>
        <div className="text-center p-3 bg-gradient-to-br from-orange-600 to-orange-700 rounded-lg border border-orange-500">
          <p className="text-orange-200 text-xs">Trend</p>
          <p className="font-bold text-white">
            {data.length > 1 && data[data.length - 1].value > data[0].value ? '📈' : 
             data.length > 1 && data[data.length - 1].value < data[0].value ? '📉' : '➖'}
          </p>
        </div>
      </div>
    </div>
  );
};

// Multi-line Chart Component
export const LineChart: React.FC<LineChartProps> = ({
  data,
  title,
  lines,
  formatValue = (value) => value.toString(),
  height = 200
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h3 className="text-lg font-bold text-white mb-4">{title}</h3>
        <div 
          className="bg-gray-700 rounded-lg flex items-center justify-center border border-gray-600"
          style={{ height: `${height}px` }}
        >
          <p className="text-gray-300">No data available</p>
        </div>
      </div>
    );
  }

  const allValues = data.flatMap(d => [d.value, d.value2 || 0]);
  const maxValue = Math.max(...allValues);
  const minValue = Math.min(0, Math.min(...allValues));
  const range = maxValue - minValue || 1;

  return (
    <div className="bg-white rounded-xl p-6 border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
        <div className="flex gap-4">
          {lines.map((line) => (
            <div key={line.key} className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${line.color}`}></div>
              <span className="text-sm text-gray-600">{line.label}</span>
            </div>
          ))}
        </div>
      </div>
      
      <div 
        className="relative bg-gray-50 rounded-lg p-4 border border-gray-200"
        style={{ height: `${height}px` }}
      >
        <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-gray-500 pr-2 w-12">
          <span>{formatValue(maxValue)}</span>
          <span>{formatValue((maxValue + minValue) / 2)}</span>
          <span>{formatValue(minValue)}</span>
        </div>
        
        <div className="ml-14 h-full relative">
          <div className="absolute inset-0">
            {[0, 0.25, 0.5, 0.75, 1].map((percent) => (
              <div
                key={percent}
                className="absolute w-full border-gray-300"
                style={{
                  top: `${percent * 100}%`,
                  borderTopWidth: '0.5px'
                }}
              />
            ))}
          </div>
          
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            {lines.map((line) => (
              <g key={line.key}>
                {(() => {
                  const getStrokeColor = (colorClass: string) => {
                    if (colorClass.includes('blue')) return '#3B82F6';
                    if (colorClass.includes('green')) return '#10B981';
                    if (colorClass.includes('red')) return '#EF4444';
                    if (colorClass.includes('purple')) return '#8B5CF6';
                    if (colorClass.includes('indigo')) return '#6366F1';
                    if (colorClass.includes('yellow')) return '#F59E0B';
                    if (colorClass.includes('orange')) return '#F97316';
                    return '#6B7280';
                  };
                  
                  const strokeColor = getStrokeColor(line.color);
                  const points = data.map((point, index) => {
                    const value = line.key === 'value' ? point.value : (point.value2 || 0);
                    const x = data.length === 1 ? 50 : (index / Math.max(data.length - 1, 1)) * 100;
                    const y = range === 0 ? 50 : 100 - Math.max(5, Math.min(95, ((value - minValue) / range) * 90 + 5));
                    return `${x},${y}`;
                  }).join(' ');
                  
                  return (
                    <>
                      <polyline
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth="2"
                        points={points}
                        vectorEffect="non-scaling-stroke"
                      />
                      {data.map((point, index) => {
                        const value = line.key === 'value' ? point.value : (point.value2 || 0);
                        const x = data.length === 1 ? 50 : (index / Math.max(data.length - 1, 1)) * 100;
                        const y = range === 0 ? 50 : 100 - Math.max(5, Math.min(95, ((value - minValue) / range) * 90 + 5));
                        return (
                          <circle
                            key={`${line.key}-${index}`}
                            cx={x}
                            cy={y}
                            r="2"
                            fill={strokeColor}
                          />
                        );
                      })}
                    </>
                  );
                })()}
              </g>
            ))}
          </svg>
        </div>
        
        <div className="absolute -bottom-6 left-14 right-0 flex justify-between text-xs text-gray-500">
          {data.length > 0 && (
            <>
              <span>{new Date(data[0].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              {data.length > 2 && (
                <span>{new Date(data[Math.floor(data.length / 2)].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              )}
              <span>{new Date(data[data.length - 1].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// Pie Chart Component
export const PieChart: React.FC<PieChartProps> = ({
  data,
  title,
  formatValue = (value) => value.toString(),
  size = 200
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h3 className="text-lg font-bold text-gray-900 mb-4">{title}</h3>
        <div 
          className="bg-gray-50 rounded-lg flex items-center justify-center border border-gray-200"
          style={{ height: `${size}px` }}
        >
          <p className="text-gray-500">No data available</p>
        </div>
      </div>
    );
  }

  const total = data.reduce((sum, d) => sum + d.value, 0);
  let currentAngle = 0;

  return (
    <div className="bg-white rounded-xl p-6 border border-gray-200">
      <h3 className="text-lg font-bold text-gray-900 mb-4">{title}</h3>
      
      <div className="flex items-center gap-6">
        <div className="relative" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="transform -rotate-90">
            {data.map((segment, index) => {
              const percentage = (segment.value / total) * 100;
              const angle = (segment.value / total) * 360;
              
              // Skip segments that are too small to render
              if (percentage < 0.5) {
                return null;
              }
              
              const radius = size / 2 - 20;
              const x1 = size / 2 + radius * Math.cos((currentAngle * Math.PI) / 180);
              const y1 = size / 2 + radius * Math.sin((currentAngle * Math.PI) / 180);
              const x2 = size / 2 + radius * Math.cos(((currentAngle + angle) * Math.PI) / 180);
              const y2 = size / 2 + radius * Math.sin(((currentAngle + angle) * Math.PI) / 180);
              
              const largeArcFlag = angle > 180 ? 1 : 0;
              const pathData = `M ${size / 2} ${size / 2} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
              
              const segmentElement = (
                <path
                  key={index}
                  d={pathData}
                  fill={segment.color}
                  stroke="white"
                  strokeWidth="2"
                  className="hover:opacity-80 transition-opacity cursor-pointer"
                  title={`${segment.label}: ${formatValue(segment.value)} (${percentage.toFixed(1)}%)`}
                />
              );
              
              currentAngle += angle;
              return segmentElement;
            })}
          </svg>
          
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{formatValue(total)}</p>
              <p className="text-sm text-gray-500">Total</p>
            </div>
          </div>
        </div>
        
        <div className="flex-1 space-y-2">
          {data.map((segment, index) => {
            const percentage = (segment.value / total) * 100;
            return (
              <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full`} style={{ backgroundColor: segment.color }}></div>
                  <span className="text-sm font-medium text-gray-900">{segment.label}</span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">{formatValue(segment.value)}</p>
                  <p className="text-xs text-gray-500">{percentage.toFixed(1)}%</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SimpleChart;