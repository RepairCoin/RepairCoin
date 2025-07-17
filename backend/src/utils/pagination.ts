// backend/src/utils/pagination.ts - Updated with both cursor and offset pagination support

export interface PaginationParams {
  limit?: number;
  page?: number;  // Added for offset-based pagination
  startAfter?: string;
  cursor?: string;  // Alternative to startAfter
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}

export interface ValidatedPaginationParams {
  limit: number;
  page: number;  // Added for offset-based pagination
  startAfter?: string;
  orderBy: string;
  orderDirection: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: {
    hasMore: boolean;
    nextCursor?: string;
    limit: number;
    totalItems?: number;
    page?: number;  // Added for offset pagination
    totalPages?: number;  // Added for offset pagination
  };
}

export interface CursorPaginationParams {
  limit: number;
  cursor?: string;
  orderBy: string;
  orderDirection: 'asc' | 'desc';
}

export interface OffsetPaginationParams {
  limit: number;
  page: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}

export interface OffsetPaginatedResult<T> {
  items: T[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    hasNext: boolean;
    hasPrev: boolean;
    limit: number;
    offset: number;
  };
}

export class PaginationHelper {
  /**
   * Validate and normalize pagination parameters (supports both cursor and offset)
   */
  static validatePaginationParams(params: PaginationParams): ValidatedPaginationParams {
    const limit = Math.min(Math.max(params.limit || 50, 1), 100); // Between 1-100
    const page = Math.max(params.page || 1, 1); // Minimum page 1
    const orderBy = params.orderBy || 'created_at';
    const orderDirection = params.orderDirection || 'desc';
    const startAfter = params.startAfter || params.cursor;
    
    return {
      limit,
      page,
      startAfter,
      orderBy,
      orderDirection
    };
  }

  /**
   * Create cursor-based pagination result from items
   */
  static createPaginatedResult<T>(
    items: T[],
    requestedLimit: number,
    nextCursor?: string
  ): PaginatedResult<T> {
    const hasMore = items.length > requestedLimit;
    const resultItems = hasMore ? items.slice(0, requestedLimit) : items;
    
    return {
      items: resultItems,
      pagination: {
        hasMore,
        nextCursor: hasMore ? nextCursor : undefined,
        limit: requestedLimit
      }
    };
  }

  /**
   * Create offset-based pagination result with page info
   */
  static createOffsetPaginatedResult<T>(
    items: T[],
    totalItems: number,
    limit: number,
    page: number
  ): PaginatedResult<T> {
    const totalPages = Math.ceil(totalItems / limit);
    const hasMore = page < totalPages;
    
    return {
      items,
      pagination: {
        hasMore,
        limit,
        page,
        totalPages,
        totalItems
      }
    };
  }

  /**
   * Create detailed offset pagination result
   */
  static createDetailedOffsetPaginatedResult<T>(
    items: T[],
    totalItems: number,
    limit: number,
    offset: number
  ): OffsetPaginatedResult<T> {
    const currentPage = Math.floor(offset / limit) + 1;
    const totalPages = Math.ceil(totalItems / limit);
    
    return {
      items,
      pagination: {
        currentPage,
        totalPages,
        totalItems,
        hasNext: currentPage < totalPages,
        hasPrev: currentPage > 1,
        limit,
        offset
      }
    };
  }

  /**
   * Extract pagination params from query string
   */
  static fromQuery(query: any): PaginationParams {
    return {
      limit: query.limit ? parseInt(query.limit as string) : undefined,
      page: query.page ? parseInt(query.page as string) : undefined,
      startAfter: query.cursor || query.startAfter,
      cursor: query.cursor,
      orderBy: query.orderBy || query.sort,
      orderDirection: query.orderDirection || query.order || 'desc'
    };
  }

  /**
   * Generate next page URL for cursor-based pagination
   */
  static generateNextPageUrl(
    baseUrl: string,
    nextCursor: string,
    limit: number,
    additionalParams?: Record<string, any>
  ): string {
    const url = new URL(baseUrl);
    url.searchParams.set('cursor', nextCursor);
    url.searchParams.set('limit', limit.toString());
    
    if (additionalParams) {
      Object.entries(additionalParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, value.toString());
        }
      });
    }
    
    return url.toString();
  }

  /**
   * Generate next page URL for offset-based pagination
   */
  static generateOffsetPageUrl(
    baseUrl: string,
    page: number,
    limit: number,
    additionalParams?: Record<string, any>
  ): string {
    const url = new URL(baseUrl);
    url.searchParams.set('page', page.toString());
    url.searchParams.set('limit', limit.toString());
    
    if (additionalParams) {
      Object.entries(additionalParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, value.toString());
        }
      });
    }
    
    return url.toString();
  }

  /**
   * Calculate offset pagination info
   */
  static calculateOffsetPagination(
    page: number,
    limit: number,
    totalItems: number
  ): {
    offset: number;
    limit: number;
    currentPage: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  } {
    const normalizedPage = Math.max(1, page);
    const normalizedLimit = Math.min(Math.max(limit, 1), 100);
    const offset = (normalizedPage - 1) * normalizedLimit;
    const totalPages = Math.ceil(totalItems / normalizedLimit);
    
    return {
      offset,
      limit: normalizedLimit,
      currentPage: normalizedPage,
      totalPages,
      hasNext: normalizedPage < totalPages,
      hasPrev: normalizedPage > 1
    };
  }

  /**
   * Calculate offset from page and limit
   */
  static calculateOffset(page: number, limit: number): number {
    return (Math.max(1, page) - 1) * limit;
  }

  /**
   * Convert cursor pagination params to offset params
   */
  static cursorToOffset(
    cursorParams: PaginationParams,
    defaultPage: number = 1
  ): OffsetPaginationParams {
    const validated = this.validatePaginationParams(cursorParams);
    return {
      limit: validated.limit,
      page: validated.page || defaultPage,
      orderBy: validated.orderBy,
      orderDirection: validated.orderDirection
    };
  }

  /**
   * Validate page number and limit for SQL queries
   */
  static validateSqlPagination(page: number, limit: number): {
    page: number;
    limit: number;
    offset: number;
  } {
    const validPage = Math.max(1, Math.floor(page) || 1);
    const validLimit = Math.min(Math.max(1, Math.floor(limit) || 20), 100);
    const offset = (validPage - 1) * validLimit;
    
    return {
      page: validPage,
      limit: validLimit,
      offset
    };
  }
}

// Common pagination configurations
export const DEFAULT_PAGINATION = {
  limit: 50,
  maxLimit: 100,
  defaultPage: 1,
  orderBy: 'created_at',
  orderDirection: 'desc' as const
};

export const ADMIN_PAGINATION = {
  limit: 100,
  maxLimit: 500,
  defaultPage: 1,
  orderBy: 'created_at',
  orderDirection: 'desc' as const
};

export const MOBILE_PAGINATION = {
  limit: 20,
  maxLimit: 50,
  defaultPage: 1,
  orderBy: 'created_at',
  orderDirection: 'desc' as const
};

// Helper type for API responses
export type PaginationMeta = {
  hasMore: boolean;
  nextCursor?: string;
  page?: number;
  totalPages?: number;
  totalItems?: number;
  limit: number;
};

// Query parameter helpers for Express routes
export const extractPaginationFromQuery = (query: any): PaginationParams => {
  return PaginationHelper.fromQuery(query);
};

export const validateQueryPagination = (query: any): ValidatedPaginationParams => {
  const params = extractPaginationFromQuery(query);
  return PaginationHelper.validatePaginationParams(params);
};