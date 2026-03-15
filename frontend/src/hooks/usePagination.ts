"use client";

import { useState, useMemo, useCallback } from "react";

/**
 * Configuration options for the usePagination hook
 */
export interface UsePaginationOptions {
  /** Items per page (default: 10) */
  itemsPerPage?: number;
  /** Initial page number (default: 1) */
  initialPage?: number;
}

/**
 * Return type for the usePagination hook
 */
export interface UsePaginationReturn<T> {
  /** Current page number (1-indexed) */
  currentPage: number;
  /** Total number of pages */
  totalPages: number;
  /** Set the current page */
  setPage: (page: number) => void;
  /** Go to the next page */
  nextPage: () => void;
  /** Go to the previous page */
  prevPage: () => void;
  /** Number of items per page */
  itemsPerPage: number;
  /** Start index for current page (0-indexed) */
  startIndex: number;
  /** End index for current page (exclusive, 0-indexed) */
  endIndex: number;
  /** Paginated items for the current page */
  paginatedItems: T[];
  /** Reset to page 1 */
  reset: () => void;
}

/**
 * Hook to manage pagination state for a list of items
 *
 * @param items - The full array of items to paginate
 * @param options - Configuration options
 * @returns Pagination state and helpers
 *
 * @example
 * ```tsx
 * const { paginatedItems, currentPage, totalPages, setPage } = usePagination(members, { itemsPerPage: 10 });
 *
 * return (
 *   <>
 *     {paginatedItems.map(item => <Item key={item.id} {...item} />)}
 *     <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setPage} />
 *   </>
 * );
 * ```
 */
export function usePagination<T>(
  items: T[],
  options: UsePaginationOptions = {}
): UsePaginationReturn<T> {
  const { itemsPerPage = 10, initialPage = 1 } = options;
  const [currentPage, setCurrentPage] = useState(initialPage);

  // Calculate total pages based on items length
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(items.length / itemsPerPage)),
    [items.length, itemsPerPage]
  );

  // Ensure current page is within bounds when items change
  const validatedPage = useMemo(() => {
    if (currentPage > totalPages) {
      return totalPages;
    }
    if (currentPage < 1) {
      return 1;
    }
    return currentPage;
  }, [currentPage, totalPages]);

  // Calculate indices
  const startIndex = useMemo(
    () => (validatedPage - 1) * itemsPerPage,
    [validatedPage, itemsPerPage]
  );

  const endIndex = useMemo(
    () => Math.min(startIndex + itemsPerPage, items.length),
    [startIndex, itemsPerPage, items.length]
  );

  // Get paginated items
  const paginatedItems = useMemo(
    () => items.slice(startIndex, endIndex),
    [items, startIndex, endIndex]
  );

  // Page navigation functions
  const setPage = useCallback((page: number) => {
    const validPage = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(validPage);
  }, [totalPages]);

  const nextPage = useCallback(() => {
    setPage(validatedPage + 1);
  }, [validatedPage, setPage]);

  const prevPage = useCallback(() => {
    setPage(validatedPage - 1);
  }, [validatedPage, setPage]);

  const reset = useCallback(() => {
    setCurrentPage(1);
  }, []);

  return {
    currentPage: validatedPage,
    totalPages,
    setPage,
    nextPage,
    prevPage,
    itemsPerPage,
    startIndex,
    endIndex,
    paginatedItems,
    reset,
  };
}
