"use client";

import React, { useState } from "react";
import { ChevronDown, AlertCircle } from "lucide-react";

export interface Column<T = any> {
  key: string;
  header: string;
  accessor?: (item: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  headerClassName?: string;
}

export interface DataTableProps<T = any> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  expandable?: boolean;
  renderExpandedContent?: (item: T) => React.ReactNode;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  loading?: boolean;
  loadingRows?: number;
  className?: string;
  headerClassName?: string;
  rowClassName?: string | ((item: T) => string);
}

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  onRowClick,
  expandable = false,
  renderExpandedContent,
  emptyMessage = "No data found",
  emptyIcon,
  loading = false,
  loadingRows = 5,
  className = "",
  headerClassName = "",
  rowClassName = "",
}: DataTableProps<T>) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  } | null>(null);

  const handleRowClick = (item: T) => {
    if (expandable) {
      const key = keyExtractor(item);
      setExpandedRows((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(key)) {
          newSet.delete(key);
        } else {
          newSet.add(key);
        }
        return newSet;
      });
    }
    onRowClick?.(item);
  };

  const handleSort = (column: Column<T>) => {
    if (!column.sortable) return;

    setSortConfig((prevConfig) => {
      if (!prevConfig || prevConfig.key !== column.key) {
        return { key: column.key, direction: "asc" };
      }
      if (prevConfig.direction === "asc") {
        return { key: column.key, direction: "desc" };
      }
      return null;
    });
  };

  const sortedData = React.useMemo(() => {
    if (!sortConfig) return data;

    const sorted = [...data].sort((a, b) => {
      const column = columns.find((col) => col.key === sortConfig.key);
      if (!column || !column.accessor) return 0;

      const aValue = column.accessor(a);
      const bValue = column.accessor(b);

      // Convert to string for comparison
      const aStr = String(aValue ?? "");
      const bStr = String(bValue ?? "");

      if (sortConfig.direction === "asc") {
        return aStr.localeCompare(bStr);
      }
      return bStr.localeCompare(aStr);
    });

    return sorted;
  }, [data, sortConfig, columns]);

  if (loading) {
    return (
      <div className={`overflow-x-auto ${className}`}>
        <table className="w-full">
          <thead>
            <tr className={`border-b border-gray-700/50 ${headerClassName}`}>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`text-left py-3 px-4 text-sm font-medium text-gray-400 ${
                    column.headerClassName || ""
                  }`}
                >
                  {column.header}
                </th>
              ))}
              {expandable && <th className="w-10" />}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: loadingRows }).map((_, index) => (
              <tr key={index} className="border-b border-gray-700/30">
                {columns.map((column) => (
                  <td key={column.key} className="py-4 px-4">
                    <div className="animate-pulse">
                      <div className="h-4 bg-gray-700 rounded w-3/4"></div>
                    </div>
                  </td>
                ))}
                {expandable && (
                  <td className="py-4 px-4">
                    <div className="animate-pulse">
                      <div className="h-8 w-8 bg-gray-700 rounded"></div>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (sortedData.length === 0) {
    return (
      <div className={`text-center py-12 ${className}`}>
        {emptyIcon || <AlertCircle className="w-12 h-12 text-gray-500 mx-auto mb-4" />}
        <p className="text-gray-400">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full">
        <thead>
          <tr className={`border-b border-gray-700/50 ${headerClassName}`}>
            {columns.map((column) => (
              <th
                key={column.key}
                className={`text-left py-3 px-4 text-sm font-medium text-gray-400 ${
                  column.sortable ? "cursor-pointer hover:text-gray-300" : ""
                } ${column.headerClassName || ""}`}
                onClick={() => handleSort(column)}
              >
                <div className="flex items-center gap-2">
                  {column.header}
                  {column.sortable && sortConfig?.key === column.key && (
                    <span className="text-xs">
                      {sortConfig.direction === "asc" ? "↑" : "↓"}
                    </span>
                  )}
                </div>
              </th>
            ))}
            {expandable && <th className="w-10" />}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((item) => {
            const key = keyExtractor(item);
            const isExpanded = expandedRows.has(key);
            const getRowClass = () => {
              if (typeof rowClassName === "function") {
                return rowClassName(item);
              }
              return rowClassName;
            };

            return (
              <React.Fragment key={key}>
                <tr
                  className={`border-b border-gray-700/30 hover:bg-gray-800/30 transition-colors ${
                    expandable ? "cursor-pointer" : ""
                  } ${isExpanded ? "bg-gray-800/40" : ""} ${getRowClass()}`}
                  onClick={() => handleRowClick(item)}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`py-4 px-4 ${column.className || ""}`}
                    >
                      {column.accessor ? column.accessor(item) : null}
                    </td>
                  ))}
                  {expandable && (
                    <td className="py-4 px-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRowClick(item);
                        }}
                        className="p-1.5 bg-gray-700/30 text-gray-400 border border-gray-600/30 rounded-lg hover:bg-gray-700/50 transition-colors"
                      >
                        <ChevronDown
                          className={`w-4 h-4 transition-transform ${
                            isExpanded ? "rotate-180" : ""
                          }`}
                        />
                      </button>
                    </td>
                  )}
                </tr>
                {expandable && isExpanded && renderExpandedContent && (
                  <tr>
                    <td colSpan={columns.length + 1} className="p-0">
                      <div className="bg-gray-800/20 border-b border-gray-700/30">
                        {renderExpandedContent(item)}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}