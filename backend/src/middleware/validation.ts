// backend/src/middleware/validation.ts
import { Request, Response, NextFunction } from 'express';
import { ValidationError } from './errorHandler';
import { logger } from '../utils/logger';
import { UniquenessService } from '../services/uniquenessService';

// Validation result interface
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedValue?: any;
}

// Custom validation rules
export const ValidationRules = {
  // Ethereum address validation
  ethereumAddress: (value: string): ValidationResult => {
    if (!value) {
      return { isValid: false, errors: ['Address is required'] };
    }
    
    if (typeof value !== 'string') {
      return { isValid: false, errors: ['Address must be a string'] };
    }
    
    const addressRegex = /^0x[a-fA-F0-9]{40}$/;
    if (!addressRegex.test(value)) {
      return { isValid: false, errors: ['Invalid Ethereum address format'] };
    }
    
    return { 
      isValid: true, 
      errors: [], 
      sanitizedValue: value.toLowerCase() 
    };
  },

  // Email validation
  email: (value: string): ValidationResult => {
    if (!value) {
      return { isValid: true, errors: [] }; // Email is optional in most cases
    }
    
    if (typeof value !== 'string') {
      return { isValid: false, errors: ['Email must be a string'] };
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return { isValid: false, errors: ['Invalid email format'] };
    }
    
    // Additional email validation
    if (value.length > 254) {
      return { isValid: false, errors: ['Email too long (max 254 characters)'] };
    }
    
    return { 
      isValid: true, 
      errors: [], 
      sanitizedValue: value.toLowerCase().trim() 
    };
  },

  // Phone number validation
  phone: (value: string): ValidationResult => {
    if (!value) {
      return { isValid: true, errors: [] }; // Phone is optional
    }
    
    if (typeof value !== 'string') {
      return { isValid: false, errors: ['Phone must be a string'] };
    }
    
    // Remove all non-digits
    const cleaned = value.replace(/\D/g, '');
    
    // Check length (US format: 10 digits, international: 10-15 digits)
    if (cleaned.length < 10 || cleaned.length > 15) {
      return { isValid: false, errors: ['Phone number must be 10-15 digits'] };
    }
    
    return { 
      isValid: true, 
      errors: [], 
      sanitizedValue: cleaned 
    };
  },

  // Numeric validation with range
  numeric: (value: any, min?: number, max?: number): ValidationResult => {
    if (value === undefined || value === null) {
      return { isValid: false, errors: ['Value is required'] };
    }
    
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    
    if (isNaN(numValue)) {
      return { isValid: false, errors: ['Value must be a number'] };
    }
    
    const errors: string[] = [];
    
    if (min !== undefined && numValue < min) {
      errors.push(`Value must be at least ${min}`);
    }
    
    if (max !== undefined && numValue > max) {
      errors.push(`Value must be at most ${max}`);
    }
    
    if (errors.length > 0) {
      return { isValid: false, errors };
    }
    
    return { 
      isValid: true, 
      errors: [], 
      sanitizedValue: numValue 
    };
  },

  // String validation with length constraints
  string: (value: any, minLength?: number, maxLength?: number): ValidationResult => {
    if (!value) {
      return { isValid: false, errors: ['Value is required'] };
    }
    
    if (typeof value !== 'string') {
      return { isValid: false, errors: ['Value must be a string'] };
    }
    
    const errors: string[] = [];
    
    if (minLength !== undefined && value.length < minLength) {
      errors.push(`Value must be at least ${minLength} characters`);
    }
    
    if (maxLength !== undefined && value.length > maxLength) {
      errors.push(`Value must be at most ${maxLength} characters`);
    }
    
    if (errors.length > 0) {
      return { isValid: false, errors };
    }
    
    return { 
      isValid: true, 
      errors: [], 
      sanitizedValue: value.trim() 
    };
  },

  // Tier validation
  tier: (value: string): ValidationResult => {
    if (!value) {
      return { isValid: false, errors: ['Tier is required'] };
    }
    
    const validTiers = ['BRONZE', 'SILVER', 'GOLD'];
    const upperValue = value.toUpperCase();
    
    if (!validTiers.includes(upperValue)) {
      return { 
        isValid: false, 
        errors: [`Invalid tier. Must be one of: ${validTiers.join(', ')}`] 
      };
    }
    
    return { 
      isValid: true, 
      errors: [], 
      sanitizedValue: upperValue 
    };
  },

  // Shop ID validation
  shopId: (value: string): ValidationResult => {
    if (!value) {
      return { isValid: false, errors: ['Shop ID is required'] };
    }
    
    if (typeof value !== 'string') {
      return { isValid: false, errors: ['Shop ID must be a string'] };
    }
    
    // Shop ID format: alphanumeric, underscores, hyphens, 3-50 characters
    const shopIdRegex = /^[a-zA-Z0-9_-]{3,50}$/;
    if (!shopIdRegex.test(value)) {
      return { 
        isValid: false, 
        errors: ['Shop ID must be 3-50 characters (letters, numbers, underscore, hyphen only)'] 
      };
    }
    
    return { 
      isValid: true, 
      errors: [], 
      sanitizedValue: value.toLowerCase() 
    };
  },

  // Date validation
  date: (value: string): ValidationResult => {
    if (!value) {
      return { isValid: false, errors: ['Date is required'] };
    }
    
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return { isValid: false, errors: ['Invalid date format'] };
    }
    
    return { 
      isValid: true, 
      errors: [], 
      sanitizedValue: date.toISOString() 
    };
  },

  // Webhook event validation
  webhookEvent: (value: string): ValidationResult => {
    if (!value) {
      return { isValid: false, errors: ['Event type is required'] };
    }
    
    const validEvents = [
      'repair_completed',
      'referral_verified',
      'ad_funnel_conversion',
      'customer_registered'
    ];
    
    if (!validEvents.includes(value)) {
      return { 
        isValid: false, 
        errors: [`Invalid event type. Must be one of: ${validEvents.join(', ')}`] 
      };
    }
    
    return { 
      isValid: true, 
      errors: [], 
      sanitizedValue: value 
    };
  }
};

// Generic validation middleware factory
export const validate = (fieldName: string, ruleName: keyof typeof ValidationRules, ...ruleParams: any[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const value = req.body[fieldName] || req.params[fieldName] || req.query[fieldName];
      const rule = ValidationRules[ruleName];
      
      if (!rule) {
        throw new Error(`Unknown validation rule: ${ruleName}`);
      }
      
      const params = Array.isArray(ruleParams) ? ruleParams : [];
      const result = (rule as any)(value, ...params);
      
      if (!result.isValid) {
        const error = new ValidationError(`Validation failed for ${fieldName}: ${result.errors.join(', ')}`);
        return next(error);
      }
      
      // Update the value with sanitized version if available
      if (result.sanitizedValue !== undefined) {
        if (req.body[fieldName] !== undefined) req.body[fieldName] = result.sanitizedValue;
        if (req.params[fieldName] !== undefined) req.params[fieldName] = result.sanitizedValue;
        if (req.query[fieldName] !== undefined) req.query[fieldName] = result.sanitizedValue;
      }
      
      next();
    } catch (error: any) {
      logger.error('Validation middleware error:', error);
      next(new ValidationError(`Validation error: ${error.message}`));
    }
  };
};

// Convenience validation middleware functions
export const validateEthereumAddress = (fieldName: string) => validate(fieldName, 'ethereumAddress');
export const validateEmail = (fieldName: string) => validate(fieldName, 'email');
export const validatePhone = (fieldName: string) => validate(fieldName, 'phone');
export const validateNumeric = (fieldName: string, min?: number, max?: number) => validate(fieldName, 'numeric', min, max);
export const validateString = (fieldName: string, minLength?: number, maxLength?: number) => validate(fieldName, 'string', minLength, maxLength);
export const validateTier = (fieldName: string) => validate(fieldName, 'tier');
export const validateShopId = (fieldName: string) => validate(fieldName, 'shopId');
export const validateDate = (fieldName: string) => validate(fieldName, 'date');
export const validateWebhookEvent = (fieldName: string) => validate(fieldName, 'webhookEvent');

// Multiple field validation
export const validateFields = (validationMap: { [fieldName: string]: { rule: keyof typeof ValidationRules; params?: any[] } }) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors: string[] = [];
      const sanitizedData: { [key: string]: any } = {};
      
      for (const [fieldName, validation] of Object.entries(validationMap)) {
        const value = req.body[fieldName] || req.params[fieldName] || req.query[fieldName];
        const rule = ValidationRules[validation.rule];
        
        if (!rule) {
          errors.push(`Unknown validation rule for ${fieldName}: ${validation.rule}`);
          continue;
        }
        
        const params = Array.isArray(validation.params) ? validation.params : [];
        const result = (rule as any)(value, ...params);
        
        if (!result.isValid) {
          errors.push(`${fieldName}: ${result.errors.join(', ')}`);
        } else if (result.sanitizedValue !== undefined) {
          sanitizedData[fieldName] = result.sanitizedValue;
        }
      }
      
      if (errors.length > 0) {
        const error = new ValidationError(`Validation failed: ${errors.join('; ')}`);
        return next(error);
      }
      
      // Apply sanitized values
      for (const [fieldName, value] of Object.entries(sanitizedData)) {
        if (req.body[fieldName] !== undefined) req.body[fieldName] = value;
        if (req.params[fieldName] !== undefined) req.params[fieldName] = value;
        if (req.query[fieldName] !== undefined) req.query[fieldName] = value;
      }
      
      next();
    } catch (error: any) {
      logger.error('Multi-field validation error:', error);
      next(new ValidationError(`Validation error: ${error.message}`));
    }
  };
};

// Request body schema validation
export const validateSchema = (schema: { [key: string]: any }) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors: string[] = [];
      
      // Check required fields
      for (const [fieldName, fieldSchema] of Object.entries(schema)) {
        const value = req.body[fieldName];
        
        if (fieldSchema.required && (value === undefined || value === null || value === '')) {
          errors.push(`${fieldName} is required`);
          continue;
        }
        
        if (value !== undefined && fieldSchema.type) {
          const expectedType = fieldSchema.type;
          const actualType = typeof value;
          
          if (expectedType === 'number' && isNaN(Number(value))) {
            errors.push(`${fieldName} must be a number`);
          } else if (expectedType !== 'number' && actualType !== expectedType) {
            errors.push(`${fieldName} must be of type ${expectedType}`);
          }
        }
        
        // Custom validation function
        if (value !== undefined && fieldSchema.validate) {
          const customResult = fieldSchema.validate(value);
          if (!customResult.isValid) {
            errors.push(`${fieldName}: ${customResult.errors.join(', ')}`);
          }
        }
      }
      
      if (errors.length > 0) {
        const error = new ValidationError(`Schema validation failed: ${errors.join('; ')}`);
        return next(error);
      }
      
      next();
    } catch (error: any) {
      logger.error('Schema validation error:', error);
      next(new ValidationError(`Schema validation error: ${error.message}`));
    }
  };
};

// Rate limiting validation (prevents abuse)
export const validateRateLimit = (maxRequests: number, windowMs: number) => {
  const requestCounts = new Map<string, { count: number; resetTime: number }>();
  
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const identifier = req.ip || 'unknown';
      const now = Date.now();
      const windowStart = now - windowMs;
      
      // Clean old entries
      for (const [key, data] of requestCounts.entries()) {
        if (data.resetTime < windowStart) {
          requestCounts.delete(key);
        }
      }
      
      const current = requestCounts.get(identifier) || { count: 0, resetTime: now + windowMs };
      
      if (current.count >= maxRequests && current.resetTime > now) {
        const resetIn = Math.ceil((current.resetTime - now) / 1000);
        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded',
          retryAfter: resetIn
        });
      }
      
      current.count++;
      requestCounts.set(identifier, current);
      
      next();
    } catch (error: any) {
      logger.error('Rate limit validation error:', error);
      next(error);
    }
  };
};

// File upload validation
export const validateFileUpload = (options: {
  maxSize?: number;
  allowedTypes?: string[];
  required?: boolean;
}) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const file = (req as any).file;
      
      if (options.required && !file) {
        return next(new ValidationError('File upload is required'));
      }
      
      if (!file) {
        return next(); // File is optional and not provided
      }
      
      if (options.maxSize && file.size > options.maxSize) {
        return next(new ValidationError(`File size exceeds maximum of ${options.maxSize} bytes`));
      }
      
      if (options.allowedTypes && !options.allowedTypes.includes(file.mimetype)) {
        return next(new ValidationError(`File type not allowed. Allowed types: ${options.allowedTypes.join(', ')}`));
      }
      
      next();
    } catch (error: any) {
      logger.error('File upload validation error:', error);
      next(new ValidationError(`File validation error: ${error.message}`));
    }
  };
};

// Uniqueness validation middleware
export const validateUniqueness = (options: {
  email?: boolean;
  wallet?: boolean;
  accountType: 'customer' | 'shop';
  excludeField?: string; // For updates - field name to exclude current record
}) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const uniquenessService = new UniquenessService();
      const errors: string[] = [];
      
      const email = req.body.email;
      const walletAddress = req.body.walletAddress || req.body.wallet_address;
      
      // Get exclude values for updates
      const excludeCustomerAddress = options.excludeField && options.accountType === 'customer' 
        ? req.params[options.excludeField] || req.body[options.excludeField]
        : undefined;
      const excludeShopId = options.excludeField && options.accountType === 'shop'
        ? req.params[options.excludeField] || req.body[options.excludeField] 
        : undefined;

      if (options.email && email) {
        const emailCheck = await uniquenessService.checkEmailUniqueness(
          email, 
          excludeCustomerAddress, 
          excludeShopId
        );
        
        if (!emailCheck.isUnique) {
          const conflictType = emailCheck.conflictType === 'customer' ? 'customer' : 'shop';
          errors.push(`Email address is already registered to a ${conflictType} account`);
        }
      }

      if (options.wallet && walletAddress) {
        const walletCheck = await uniquenessService.checkWalletUniqueness(
          walletAddress, 
          excludeCustomerAddress, 
          excludeShopId
        );
        
        if (!walletCheck.isUnique) {
          const conflictType = walletCheck.conflictType === 'customer' ? 'customer' : 'shop';
          errors.push(`Wallet address is already registered to a ${conflictType} account`);
        }
      }

      if (errors.length > 0) {
        return next(new ValidationError(errors.join('; ')));
      }

      next();
    } catch (error: any) {
      logger.error('Uniqueness validation error:', error);
      next(new ValidationError(`Uniqueness validation error: ${error.message}`));
    }
  };
};

// Convenience functions for uniqueness validation
export const validateCustomerUniqueness = (options: { email?: boolean; wallet?: boolean; excludeField?: string }) => 
  validateUniqueness({ ...options, accountType: 'customer' });

export const validateShopUniqueness = (options: { email?: boolean; wallet?: boolean; excludeField?: string }) => 
  validateUniqueness({ ...options, accountType: 'shop' });

// Export commonly used validation schemas
export const CommonSchemas = {
  customerRegistration: {
    walletAddress: { required: true, type: 'string', validate: ValidationRules.ethereumAddress },
    email: { required: false, type: 'string', validate: ValidationRules.email },
    phone: { required: false, type: 'string', validate: ValidationRules.phone }
  },
  
  shopRegistration: {
    shopId: { required: true, type: 'string', validate: ValidationRules.shopId },
    name: { required: true, type: 'string', validate: (v: string) => ValidationRules.string(v, 2, 100) },
    walletAddress: { required: true, type: 'string', validate: ValidationRules.ethereumAddress },
    email: { required: true, type: 'string', validate: ValidationRules.email },
    phone: { required: true, type: 'string', validate: ValidationRules.phone }
  },
  
  tokenMint: {
    customerAddress: { required: true, type: 'string', validate: ValidationRules.ethereumAddress },
    amount: { required: true, type: 'number', validate: (v: number) => ValidationRules.numeric(v, 0.1, 1000) },
    reason: { required: true, type: 'string', validate: (v: string) => ValidationRules.string(v, 5, 200) }
  },
  
  redemption: {
    customerAddress: { required: true, type: 'string', validate: ValidationRules.ethereumAddress },
    shopId: { required: true, type: 'string', validate: ValidationRules.shopId },
    amount: { required: true, type: 'number', validate: (v: number) => ValidationRules.numeric(v, 0.1, 1000) }
  }
};