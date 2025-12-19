// backend/src/middleware/captcha.ts
import { Request, Response, NextFunction } from 'express';
import { captchaService } from '../services/CaptchaService';
import { logger } from '../utils/logger';

/**
 * Middleware to verify reCAPTCHA token
 * Expects captchaToken in request body
 */
export const verifyCaptcha = (expectedAction?: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip if CAPTCHA is disabled
    if (!captchaService.isEnabled()) {
      return next();
    }

    try {
      const captchaToken = req.body.captchaToken;

      if (!captchaToken) {
        logger.warn('CAPTCHA token missing in request', {
          path: req.path,
          ip: req.ip
        });
        return res.status(400).json({
          success: false,
          error: 'CAPTCHA verification required',
          code: 'CAPTCHA_REQUIRED'
        });
      }

      // Verify the token
      const result = await captchaService.verify(
        captchaToken,
        expectedAction,
        req.ip
      );

      if (!result.valid) {
        logger.warn('CAPTCHA verification failed', {
          path: req.path,
          ip: req.ip,
          message: result.message
        });
        return res.status(400).json({
          success: false,
          error: result.message || 'CAPTCHA verification failed',
          code: 'CAPTCHA_FAILED'
        });
      }

      // CAPTCHA verified successfully
      logger.debug('CAPTCHA verified successfully', {
        path: req.path,
        action: expectedAction
      });

      // Continue to next middleware
      next();
    } catch (error) {
      logger.error('CAPTCHA middleware error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to verify CAPTCHA',
        code: 'CAPTCHA_ERROR'
      });
    }
  };
};

/**
 * Convenience middlewares for common actions
 */
export const verifyCaptchaRegister = verifyCaptcha('register');
export const verifyCaptchaLogin = verifyCaptcha('login');
export const verifyCaptchaContact = verifyCaptcha('contact');
