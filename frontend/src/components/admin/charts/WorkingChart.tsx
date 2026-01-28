'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

// Helper function to format large numbers compactly for Y-axis labels
const formatCompact = (value: number): string => {
  const absValue = Math.abs(value);
  if (absValue >= 1000000) {
    return (value / 1000000).toFixed(1) + 'M';
  }
  if (absValue >= 1000) {
    return (value / 1000).toFixed(1) + 'K';
  }
  if (absValue >= 100) {
    return value.toFixed(0);
  }
  if (absValue >= 1) {
    return value.toFixed(1);
  }
  return value.toFixed(2);
};

interface DataPoint {
  date: string;
  value: number;
  label?: string;
  category?: string;
}

interface WorkingChartProps {
  data: DataPoint[];
  title: string;
  color?: string;
  formatValue?: (value: number) => string;
  height?: number;
  type?: 'bar' | 'line';
}

interface WorkingLineChartProps {
  data: Array<{ date: string; value: number; value2?: number; label?: string }>;
  title: string;
  lines: Array<{ key: 'value' | 'value2'; color: string; label: string }>;
  formatValue?: (value: number) => string;
  height?: number;
}

interface WorkingPieChartProps {
  data: Array<{ label: string; value: number; color: string }>;
  title: string;
  formatValue?: (value: number) => string;
  size?: number;
}

export const WorkingChart: React.FC<WorkingChartProps> = ({
  data,
  title,
  color = '#FFCC00',
  formatValue = (value) => value.toString(),
  height = 200,
  type = 'bar'
}) => {
  
  if (!data || data.length === 0) {
    return (
      <div className="bg-[#212121] rounded-2xl shadow-xl p-8 border border-[#FFCC00]/20">
        <h3 className="text-2xl font-bold text-[#FFCC00] mb-6">{title}</h3>
        <div 
          className="bg-gradient-to-br from-[#0D0D0D] to-[#212121] rounded-xl flex items-center justify-center border border-[#FFCC00]/30"
          style={{ height: `${height}px` }}
        >
          <p className="text-[#FFCC00]/70 text-lg">No data available</p>
        </div>
      </div>
    );
  }

  const values = data.map(d => Number(d.value) || 0);
  const maxValue = Math.max(...values, 1);
  const minValue = Math.min(0, Math.min(...values));
  const range = maxValue - minValue || 1;

  const getColor = (colorInput: string) => {
    if (colorInput.startsWith('#')) return colorInput;
    if (colorInput.includes('blue')) return '#4F9EF8';
    if (colorInput.includes('green')) return '#22C55E';
    if (colorInput.includes('red')) return '#EF4444';
    if (colorInput.includes('purple')) return '#A855F7';
    if (colorInput.includes('indigo')) return '#6366F1';
    if (colorInput.includes('yellow')) return '#FFCC00';
    if (colorInput.includes('orange')) return '#FB923C';
    return '#FFCC00';
  };

  const chartColor = getColor(color);

  const renderBarChart = () => {
    
    return (
      <div className="absolute inset-0 flex items-end justify-center gap-1 p-2">
        {data.map((point, index) => {
          const value = Number(point.value) || 0;
          const heightPercent = Math.max(5, ((value - minValue) / range) * 90);
          
          
          return (
            <div
              key={index}
              className="relative group flex-1 flex justify-center items-end"
              style={{ 
                maxWidth: `${Math.max(100 / data.length - 1, 6)}%`,
                height: '100%'
              }}
            >
              <div
                style={{ 
                  height: `${heightPercent}%`,
                  background: `linear-gradient(to top, ${chartColor}, ${chartColor}ee)`,
                  width: data.length > 6 ? '85%' : '75%',
                  minHeight: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  minWidth: '12px',
                  position: 'relative',
                  zIndex: 10
                }}
                className="rounded-t-lg transition-all duration-300 group-hover:opacity-90 group-hover:scale-110 cursor-pointer"
                title={`${point.date}: ${formatValue(value)}`}
              />
              
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-3 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none z-20">
                <div className="bg-gray-900 text-white text-sm rounded-lg px-3 py-2 whitespace-nowrap shadow-xl border border-gray-700">
                  <div className="font-bold text-white">{formatValue(value)}</div>
                  <div className="text-gray-300 text-xs">{point.date.length > 10 ? new Date(point.date).toLocaleDateString() : point.date}</div>
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderLineChart = () => {
    const points = data.map((point, index) => {
      const value = Number(point.value) || 0;
      const x = (index / Math.max(data.length - 1, 1)) * 100;
      const y = 100 - Math.max(2, Math.min(98, ((value - minValue) / range) * 96 + 2));
      return { x, y, value, point };
    });

    const pointsStr = points.map(p => `${p.x},${p.y}`).join(' ');

    return (
      <div className="absolute inset-2">
        <svg width="100%" height="100%" className="overflow-visible">
          <defs>
            <linearGradient id={`gradient-${chartColor.slice(1)}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={chartColor} stopOpacity="0.3" />
              <stop offset="100%" stopColor={chartColor} stopOpacity="0.1" />
            </linearGradient>
          </defs>
          <polyline
            fill="none"
            stroke={chartColor}
            strokeWidth="3"
            points={pointsStr}
            filter="drop-shadow(0 2px 4px rgba(0,0,0,0.1))"
          />
          {points.map((p, index) => (
            <circle
              key={index}
              cx={`${p.x}%`}
              cy={`${p.y}%`}
              r="3"
              fill={chartColor}
              stroke="#FFCC00"
              strokeWidth="2"
              className="hover:r-5 transition-all cursor-pointer opacity-80"
              title={`${p.point.date}: ${formatValue(p.value)}`}
            />
          ))}
        </svg>
      </div>
    );
  };

  return (
    <div className="bg-[#212121] rounded-2xl shadow-xl p-4 sm:p-8 border border-[#FFCC00]/20 hover:shadow-2xl hover:border-[#FFCC00]/40 transition-all duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 sm:mb-6">
        <h3 className="text-lg sm:text-2xl font-bold text-[#FFCC00]">{title}</h3>
        <div className="text-xs bg-yellow-500 text-black px-2 py-1 rounded font-bold self-start sm:self-auto">
          {type.toUpperCase()} | {data?.length || 0} items
        </div>
      </div>

      {/* Y-axis labels - shown horizontally above chart on mobile */}
      <div className="flex sm:hidden justify-between mb-2 px-1">
        <span className="bg-[#0D0D0D] px-2 py-1 rounded shadow-sm text-[#FFCC00] border border-[#FFCC00]/30 text-[10px]">{formatCompact(minValue)}</span>
        <span className="bg-[#0D0D0D] px-2 py-1 rounded shadow-sm text-[#FFCC00] border border-[#FFCC00]/30 text-[10px]">{formatCompact((maxValue + minValue) / 2)}</span>
        <span className="bg-[#0D0D0D] px-2 py-1 rounded shadow-sm text-[#FFCC00] border border-[#FFCC00]/30 text-[10px]">{formatCompact(maxValue)}</span>
      </div>

      <div className="relative" style={{ height: `${height + 60}px` }}>
        {/* Y-axis labels - vertical on desktop only */}
        <div className="hidden sm:flex absolute left-0 top-0 flex-col justify-between text-xs font-medium text-[#FFCC00]/70 w-auto min-w-16 max-w-32" style={{ height: `${height}px` }}>
          <span className="bg-[#0D0D0D] px-2 py-1 rounded shadow-sm text-[#FFCC00] border border-[#FFCC00]/30 whitespace-nowrap text-xs">{formatValue(maxValue)}</span>
          <span className="bg-[#0D0D0D] px-2 py-1 rounded shadow-sm text-[#FFCC00] border border-[#FFCC00]/30 whitespace-nowrap text-xs">{formatValue((maxValue + minValue) / 2)}</span>
          <span className="bg-[#0D0D0D] px-2 py-1 rounded shadow-sm text-[#FFCC00] border border-[#FFCC00]/30 whitespace-nowrap text-xs">{formatValue(minValue)}</span>
        </div>

        <div className="sm:ml-36 relative bg-gradient-to-br from-[#0D0D0D] to-[#212121] rounded-xl border border-[#FFCC00]/30 shadow-inner" style={{ height: `${height}px` }}>
          <div className="absolute inset-0 p-2">
            {[0, 0.25, 0.5, 0.75, 1].map((percent) => (
              <div
                key={percent}
                className="absolute w-full border-gray-500"
                style={{
                  top: `${percent * 100}%`,
                  borderTopWidth: '0.5px',
                  borderColor: '#FFCC00',
                  opacity: 0.2,
                  left: 0,
                  right: 0
                }}
              />
            ))}
          </div>
          
          {type === 'bar' ? renderBarChart() : renderLineChart()}
          
        </div>
        
        {/* X-axis labels */}
        {type === 'bar' ? (
          <div className="absolute bottom-0 left-0 sm:left-36 right-0 flex gap-1 mt-4 overflow-x-auto">
            {data.map((point, index) => (
              <div
                key={index}
                className="flex-1 text-center min-w-0"
                style={{ maxWidth: `${100 / data.length}%` }}
              >
                <span
                  className="bg-gray-700 px-1 py-1 rounded shadow-sm text-white block truncate"
                  title={point.date}
                  style={{ fontSize: '8px' }}
                >
                  {point.date.length > 4 ? point.date.substring(0, 4) : point.date}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="absolute bottom-0 left-0 sm:left-36 right-0 flex justify-between text-xs sm:text-sm font-medium text-gray-300 mt-4">
            {data.length > 0 && (
              <>
                <span className="bg-gray-700 px-1 sm:px-2 py-1 rounded shadow-sm text-white text-[10px] sm:text-xs">{data[0].date.length > 10 ? new Date(data[0].date).toLocaleDateString() : data[0].date}</span>
                {data.length > 2 && (
                  <span className="bg-gray-700 px-1 sm:px-2 py-1 rounded shadow-sm text-white hidden sm:block text-[10px] sm:text-xs">{data[Math.floor(data.length / 2)].date.length > 10 ? new Date(data[Math.floor(data.length / 2)].date).toLocaleDateString() : data[Math.floor(data.length / 2)].date}</span>
                )}
                <span className="bg-gray-700 px-1 sm:px-2 py-1 rounded shadow-sm text-white text-[10px] sm:text-xs">{data[data.length - 1].date.length > 10 ? new Date(data[data.length - 1].date).toLocaleDateString() : data[data.length - 1].date}</span>
              </>
            )}
          </div>
        )}
      </div>
      
      <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6">
        <div className="text-center p-3 sm:p-4 bg-gradient-to-br from-[#FFCC00]/20 to-[#FFCC00]/30 rounded-xl border border-[#FFCC00]/40 shadow-sm">
          <p className="text-[#FFCC00]/80 text-xs sm:text-sm font-medium mb-1">Peak</p>
          <p className="text-sm sm:text-xl font-bold text-[#FFCC00] truncate">{formatValue(maxValue)}</p>
        </div>
        <div className="text-center p-3 sm:p-4 bg-gradient-to-br from-[#22C55E]/20 to-[#22C55E]/30 rounded-xl border border-[#22C55E]/40 shadow-sm">
          <p className="text-[#22C55E]/80 text-xs sm:text-sm font-medium mb-1">Average</p>
          <p className="text-sm sm:text-xl font-bold text-[#22C55E] truncate">
            {formatValue(Math.round(values.reduce((sum, v) => sum + v, 0) / values.length))}
          </p>
        </div>
        <div className="text-center p-3 sm:p-4 bg-gradient-to-br from-[#A855F7]/20 to-[#A855F7]/30 rounded-xl border border-[#A855F7]/40 shadow-sm">
          <p className="text-[#A855F7]/80 text-xs sm:text-sm font-medium mb-1">Total</p>
          <p className="text-sm sm:text-xl font-bold text-[#A855F7] truncate">{formatValue(values.reduce((sum, v) => sum + v, 0))}</p>
        </div>
        <div className="text-center p-3 sm:p-4 bg-gradient-to-br from-[#4F9EF8]/20 to-[#4F9EF8]/30 rounded-xl border border-[#4F9EF8]/40 shadow-sm">
          <p className="text-[#4F9EF8]/80 text-xs sm:text-sm font-medium mb-1">Trend</p>
          <div className="flex justify-center">
            {values.length > 1 && values[values.length - 1] > values[0] ? <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-[#22C55E]" /> :
             values.length > 1 && values[values.length - 1] < values[0] ? <TrendingDown className="w-6 h-6 sm:w-8 sm:h-8 text-[#EF4444]" /> : <Minus className="w-6 h-6 sm:w-8 sm:h-8 text-[#4F9EF8]" />}
          </div>
        </div>
      </div>
    </div>
  );
};

export const WorkingLineChart: React.FC<WorkingLineChartProps> = ({
  data,
  title,
  lines,
  formatValue = (value) => value.toString(),
  height = 200
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="bg-[#212121] rounded-2xl shadow-xl p-8 border border-[#FFCC00]/20">
        <h3 className="text-2xl font-bold text-[#FFCC00] mb-6">{title}</h3>
        <div 
          className="bg-gradient-to-br from-[#0D0D0D] to-[#212121] rounded-xl flex items-center justify-center border border-[#FFCC00]/30"
          style={{ height: `${height}px` }}
        >
          <p className="text-[#FFCC00]/70 text-lg">No data available</p>
        </div>
      </div>
    );
  }

  const allValues = data.flatMap(d => [d.value, d.value2 || 0]).filter(v => !isNaN(v));
  const maxValue = Math.max(...allValues, 1);
  const minValue = Math.min(0, Math.min(...allValues));
  const range = maxValue - minValue || 1;

  const getColor = (colorInput: string) => {
    if (colorInput.startsWith('#')) return colorInput;
    if (colorInput.includes('blue')) return '#3B82F6';
    if (colorInput.includes('green')) return '#10B981';
    if (colorInput.includes('red')) return '#EF4444';
    if (colorInput.includes('purple')) return '#8B5CF6';
    return '#3B82F6';
  };

  return (
    <div className="bg-[#212121] rounded-2xl shadow-xl p-4 sm:p-8 border border-[#FFCC00]/20 hover:shadow-2xl hover:border-[#FFCC00]/40 transition-all duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
        <h3 className="text-lg sm:text-2xl font-bold text-[#FFCC00]">{title}</h3>
        <div className="flex gap-3 sm:gap-6 flex-wrap">
          {lines.map((line) => (
            <div key={line.key} className="flex items-center gap-2 sm:gap-3">
              <div
                className="w-3 h-3 sm:w-4 sm:h-4 rounded-full shadow-sm border border-[#FFCC00]/40"
                style={{ backgroundColor: getColor(line.color) }}
              ></div>
              <span className="text-xs sm:text-sm font-medium text-[#FFCC00]/80">{line.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Y-axis labels - shown horizontally above chart on mobile */}
      <div className="flex sm:hidden justify-between mb-2 px-1">
        <span className="bg-[#0D0D0D] px-2 py-1 rounded shadow-sm text-[#FFCC00] border border-[#FFCC00]/30 text-[10px]">{formatCompact(minValue)}</span>
        <span className="bg-[#0D0D0D] px-2 py-1 rounded shadow-sm text-[#FFCC00] border border-[#FFCC00]/30 text-[10px]">{formatCompact((maxValue + minValue) / 2)}</span>
        <span className="bg-[#0D0D0D] px-2 py-1 rounded shadow-sm text-[#FFCC00] border border-[#FFCC00]/30 text-[10px]">{formatCompact(maxValue)}</span>
      </div>

      <div className="relative" style={{ height: `${height + 40}px` }}>
        {/* Y-axis labels - vertical on desktop only */}
        <div className="hidden sm:flex absolute left-0 top-0 flex-col justify-between text-xs text-[#FFCC00]/70 w-auto min-w-16 max-w-32" style={{ height: `${height}px` }}>
          <span className="bg-[#0D0D0D] px-2 py-1 rounded shadow-sm text-[#FFCC00] border border-[#FFCC00]/30 whitespace-nowrap text-xs">{formatValue(maxValue)}</span>
          <span className="bg-[#0D0D0D] px-2 py-1 rounded shadow-sm text-[#FFCC00] border border-[#FFCC00]/30 whitespace-nowrap text-xs">{formatValue((maxValue + minValue) / 2)}</span>
          <span className="bg-[#0D0D0D] px-2 py-1 rounded shadow-sm text-[#FFCC00] border border-[#FFCC00]/30 whitespace-nowrap text-xs">{formatValue(minValue)}</span>
        </div>

        <div className="sm:ml-36 relative bg-gradient-to-br from-[#0D0D0D] to-[#212121] rounded-xl border border-[#FFCC00]/30 shadow-inner" style={{ height: `${height}px` }}>
          <div className="absolute inset-0">
            {[0, 0.25, 0.5, 0.75, 1].map((percent) => (
              <div
                key={percent}
                className="absolute w-full"
                style={{
                  top: `${percent * 100}%`,
                  borderTopWidth: '0.5px',
                  borderColor: '#FFCC00',
                  opacity: 0.2,
                  left: 0,
                  right: 0
                }}
              />
            ))}
          </div>

          <div className="absolute inset-0">
            <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" className="overflow-hidden">
              <defs>
                {lines.map((line) => {
                  const color = getColor(line.color);
                  return (
                    <linearGradient key={`gradient-${line.key}`} id={`gradient-${line.key}`} x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                      <stop offset="100%" stopColor={color} stopOpacity="0.1" />
                    </linearGradient>
                  );
                })}
              </defs>
              {lines.map((line) => {
                const color = getColor(line.color);
                
                // Force create 30 evenly distributed points across FULL width
                const points = [];
                
                // Create exactly 30 points spanning with padding to prevent overflow
                for (let i = 0; i < 30; i++) {
                  const x = 2 + (i / 29) * 96; // 2% to 98% width with padding
                  
                  // Find if we have actual data for this position
                  let value = 0;
                  let actualPoint = null;
                  
                  if (i < data.length) {
                    const dataPoint = data[i];
                    value = line.key === 'value' ? (dataPoint.value || 0) : (dataPoint.value2 || 0);
                    actualPoint = dataPoint;
                  }
                  
                  const y = range === 0 ? 95 : Math.max(5, 95 - ((value - minValue) / range) * 90);
                  points.push({ x, y, value, point: actualPoint || { date: `day-${i}` } });
                }
                
                const pointsStr = points.map(p => `${p.x},${p.y}`).join(' ');
                
                // Create fill area that goes to actual bottom  
                const baselineY = 95; // Bottom of chart area (matching Y calculation)
                const fillPoints = [
                  `${points[0].x},${baselineY}`,
                  ...points.map(p => `${p.x},${p.y}`),
                  `${points[points.length - 1].x},${baselineY}`
                ].join(' ');
                
                // Create continuous baseline with padding to match data points
                const baselinePoints = [
                  `2,${baselineY}`,
                  `98,${baselineY}`
                ];
                const baselineStr = baselinePoints.join(' ');
                
                // The complete dataset already spans full width, no need for additional points
                const extendedPointsStr = pointsStr;
                
                return (
                  <g key={line.key}>
                    {/* Fill area */}
                    <polygon
                      fill={`url(#gradient-${line.key})`}
                      points={fillPoints}
                      opacity="0.4"
                    />
                    {/* Baseline that spans full width */}
                    <polyline
                      fill="none"
                      stroke={color}
                      strokeWidth="0.2"
                      points={baselineStr}
                      opacity="0.3"
                    />
                    {/* Main data line */}
                    <polyline
                      fill="none"
                      stroke={color}
                      strokeWidth="0.5"
                      points={pointsStr}
                      filter="drop-shadow(0 0.5px 1px rgba(0,0,0,0.1))"
                    />
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
        
        <div className="absolute bottom-0 left-0 sm:left-36 right-0 flex justify-between text-xs text-[#FFCC00]/70 mt-2">
          {data.length > 0 && (
            <>
              <span className="bg-[#0D0D0D] px-1 sm:px-2 py-1 rounded shadow-sm text-[#FFCC00] border border-[#FFCC00]/30 text-[10px] sm:text-xs">{new Date(data[0].date).toLocaleDateString()}</span>
              {data.length > 2 && (
                <span className="bg-[#0D0D0D] px-1 sm:px-2 py-1 rounded shadow-sm text-[#FFCC00] border border-[#FFCC00]/30 hidden sm:block text-[10px] sm:text-xs">{new Date(data[Math.floor(data.length / 2)].date).toLocaleDateString()}</span>
              )}
              <span className="bg-[#0D0D0D] px-1 sm:px-2 py-1 rounded shadow-sm text-[#FFCC00] border border-[#FFCC00]/30 text-[10px] sm:text-xs">{new Date(data[data.length - 1].date).toLocaleDateString()}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export const WorkingPieChart: React.FC<WorkingPieChartProps> = ({
  data,
  title,
  formatValue = (value) => value.toString(),
  size = 200
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="bg-[#212121] rounded-2xl shadow-xl p-8 border border-[#FFCC00]/20">
        <h3 className="text-2xl font-bold text-[#FFCC00] mb-6">{title}</h3>
        <div 
          className="bg-gradient-to-br from-[#0D0D0D] to-[#212121] rounded-xl flex items-center justify-center border border-[#FFCC00]/30"
          style={{ height: `${size}px` }}
        >
          <p className="text-[#FFCC00]/70 text-lg">No data available</p>
        </div>
      </div>
    );
  }

  const total = data.reduce((sum, d) => sum + d.value, 0);

  const renderPieSlices = () => {
    let currentAngle = 0;
    return data.map((segment, index) => {
      const percentage = (segment.value / total) * 100;
      const angle = (segment.value / total) * 360;
      
      if (percentage < 0.5) return null;
      
      const radius = size / 2 - 10;
      const centerX = size / 2;
      const centerY = size / 2;
      
      const x1 = centerX + radius * Math.cos((currentAngle * Math.PI) / 180);
      const y1 = centerY + radius * Math.sin((currentAngle * Math.PI) / 180);
      const x2 = centerX + radius * Math.cos(((currentAngle + angle) * Math.PI) / 180);
      const y2 = centerY + radius * Math.sin(((currentAngle + angle) * Math.PI) / 180);
      
      const largeArcFlag = angle > 180 ? 1 : 0;
      const pathData = `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
      
      const result = (
        <path
          key={index}
          d={pathData}
          fill={segment.color}
          stroke="white"
          strokeWidth="3"
          className="hover:opacity-90 hover:scale-105 transition-all duration-300 cursor-pointer filter drop-shadow-sm"
          title={`${segment.label}: ${formatValue(segment.value)} (${percentage.toFixed(1)}%)`}
        />
      );
      
      currentAngle += angle;
      return result;
    });
  };

  // Calculate responsive size for mobile
  const mobileSize = Math.min(size, 200);

  return (
    <div className="bg-[#212121] rounded-2xl shadow-xl p-4 sm:p-8 border border-[#FFCC00]/20 hover:shadow-2xl hover:border-[#FFCC00]/40 transition-all duration-300">
      <h3 className="text-lg sm:text-2xl font-bold text-[#FFCC00] mb-4 sm:mb-6">{title}</h3>

      <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
        {/* Pie Chart */}
        <div className="relative flex-shrink-0" style={{ width: mobileSize, height: mobileSize }}>
          <svg width={mobileSize} height={mobileSize} className="transform -rotate-90 filter drop-shadow-lg w-full h-full" viewBox={`0 0 ${size} ${size}`}>
            {renderPieSlices()}
          </svg>

          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center bg-[#0D0D0D] rounded-full p-3 sm:p-4 shadow-lg border border-[#FFCC00]/40">
              <p className="text-xl sm:text-3xl font-bold text-[#FFCC00]">{formatValue(total)}</p>
              <p className="text-xs sm:text-sm font-medium text-[#FFCC00]/70">Total</p>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="w-full sm:flex-1 space-y-2 sm:space-y-3">
          {data.map((segment, index) => {
            const percentage = (segment.value / total) * 100;
            return (
              <div key={index} className="flex items-center justify-between p-3 sm:p-4 bg-gradient-to-r from-[#0D0D0D] to-[#212121] rounded-xl border border-[#FFCC00]/20 hover:shadow-md hover:border-[#FFCC00]/40 transition-all duration-200">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <div
                    className="w-3 h-3 sm:w-4 sm:h-4 rounded-full shadow-sm border border-[#FFCC00]/40 flex-shrink-0"
                    style={{ backgroundColor: segment.color }}
                  ></div>
                  <span className="text-xs sm:text-sm font-semibold text-[#FFCC00] truncate">{segment.label}</span>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <p className="text-sm sm:text-lg font-bold text-[#FFCC00]">{formatValue(segment.value)}</p>
                  <p className="text-[10px] sm:text-xs font-medium text-[#FFCC00]/70">{percentage.toFixed(1)}%</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default WorkingChart;