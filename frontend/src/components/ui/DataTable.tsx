"use client";

import React, { useState, useMemo } from "react";
import { ChevronDown, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";

export interface Column<T = any> {
  key: string;
  header: string;
  accessor?: (item: T) => React.ReactNode;
  sortable?: boolean;
  sortValue?: (item: T) => string | number; // Function to extract the value for sorting
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
  // Pagination props
  itemsPerPage?: number;
  showPagination?: boolean;
  paginationClassName?: string;
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
  itemsPerPage = 10,
  showPagination = false,
  paginationClassName = "",
}: DataTableProps<T>) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

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

  const sortedData = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];
    if (!sortConfig) return data;

    const sorted = [...data].sort((a, b) => {
      const column = columns.find((col) => col.key === sortConfig.key);
      if (!column) return 0;

      let aValue: any;
      let bValue: any;

      // Use sortValue if provided, otherwise fall back to accessor
      if (column.sortValue) {
        aValue = column.sortValue(a);
        bValue = column.sortValue(b);
      } else if (column.accessor) {
        aValue = column.accessor(a);
        bValue = column.accessor(b);
      } else {
        return 0;
      }

      // Handle numeric comparisons
      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortConfig.direction === "asc" ? aValue - bValue : bValue - aValue;
      }

      // Convert to string for comparison
      const aStr = String(aValue ?? "");
      const bStr = String(bValue ?? "");

      if (sortConfig.direction === "asc") {
        return aStr.localeCompare(bStr, undefined, { numeric: true, sensitivity: "base" });
      }
      return bStr.localeCompare(aStr, undefined, { numeric: true, sensitivity: "base" });
    });

    return sorted;
  }, [data, sortConfig, columns]);

  // Calculate pagination
  const totalPages = useMemo(() => {
    if (!showPagination) return 1;
    return Math.ceil(sortedData.length / itemsPerPage);
  }, [sortedData.length, itemsPerPage, showPagination]);

  const paginatedData = useMemo(() => {
    if (!showPagination) return sortedData;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return sortedData.slice(startIndex, endIndex);
  }, [sortedData, currentPage, itemsPerPage, showPagination]);

  // Reset to page 1 when data changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [data.length]);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const maxButtons = 5;
    
    if (totalPages <= maxButtons) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) {
          pages.push(i);
        }
        pages.push(-1); // Ellipsis
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push(-1); // Ellipsis
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push(-1); // Ellipsis
        pages.push(currentPage - 1);
        pages.push(currentPage);
        pages.push(currentPage + 1);
        pages.push(-1); // Ellipsis
        pages.push(totalPages);
      }
    }
    
    return pages;
  }, [currentPage, totalPages]);

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
    <div className={className}>
      <div className="overflow-x-auto">
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
            {paginatedData.map((item) => {
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
    
    {/* Pagination Controls */}
    {showPagination && totalPages > 1 && (
      <div className={`flex flex-col items-center mt-6 ${paginationClassName}`}>
        <div className="flex items-center gap-2">
          {/* Previous Button */}
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
            className="p-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:bg-gray-700 hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          {/* Page Numbers */}
          <div className="flex items-center gap-1">
            {pageNumbers.map((page, index) => {
              if (page === -1) {
                return (
                  <span key={`ellipsis-${index}`} className="px-2 text-gray-500">
                    ...
                  </span>
                );
              }
              
              return (
                <button
                  key={page}
                  onClick={() => goToPage(page)}
                  className={`min-w-[40px] px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
                    currentPage === page
                      ? "bg-[#FFCC00] text-black"
                      : "bg-gray-800 border border-gray-700 text-gray-400 hover:bg-gray-700 hover:text-gray-300"
                  }`}
                >
                  {page}
                </button>
              );
            })}
          </div>
          
          {/* Next Button */}
          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="p-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:bg-gray-700 hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    )}
  </div>
  );
}