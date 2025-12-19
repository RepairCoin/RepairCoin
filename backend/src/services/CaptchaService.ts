// backend/src/services/CaptchaService.ts
import axios from 'axios';
import { logger } from '../utils/logger';

export interface CaptchaVerificationResult {
  success: boolean;
  score?: number;
  action?: string;
  challenge_ts?: string;
  hostname?: string;
  'error-codes'?: string[];
}

export class CaptchaService {
  private secretKey: string;
  private enabled: boolean;
  private minScore: number;

  constructor() {
    this.secretKey = process.env.RECAPTCHA_SECRET_KEY || '';
    this.enabled = process.env.ENABLE_CAPTCHA === 'true';
    this.minScore = parseFloat(process.env.RECAPTCHA_MIN_SCORE || '0.5');

    if (this.enabled && !this.secretKey) {
      logger.warn('CAPTCHA is enabled but RECAPTCHA_SECRET_KEY is not set');
      this.enabled = false;
    }

    logger.info('CaptchaService initialized', {
      enabled: this.enabled,
      minScore: this.minScore
    });
  }

  /**
   * Verify reCAPTCHA v3 token
   * @param token - The reCAPTCHA token from the frontend
   * @param expectedAction - The expected action (e.g., 'register', 'login')
   * @param remoteIp - Optional: The user's IP address
   * @returns Verification result with success flag and score
   */
  async verifyToken(
    token: string,
    expectedAction?: string,
    remoteIp?: string
  ): Promise<CaptchaVerificationResult> {
    // If CAPTCHA is disabled, always return success
    if (!this.enabled) {
      logger.debug('CAPTCHA verification skipped (disabled)');
      return {
        success: true,
        score: 1.0,
        action: expectedAction
      };
    }

    if (!token) {
      logger.warn('CAPTCHA verification failed: no token provided');
      return {
        success: false,
        'error-codes': ['missing-input-response']
      };
    }

    try {
      const params = new URLSearchParams({
        secret: this.secretKey,
        response: token,
        ...(remoteIp && { remoteip: remoteIp })
      });

      const response = await axios.post<CaptchaVerificationResult>(
        'https://www.google.com/recaptcha/api/siteverify',
        params,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          timeout: 5000
        }
      );

      const result = response.data;

      // Log verification attempt
      logger.debug('CAPTCHA verification result', {
        success: result.success,
        score: result.score,
        action: result.action,
        expectedAction,
        errorCodes: result['error-codes']
      });

      // Check if verification was successful
      if (!result.success) {
        logger.warn('CAPTCHA verification failed', {
          errorCodes: result['error-codes']
        });
        return result;
      }

      // Check action if provided
      if (expectedAction && result.action !== expectedAction) {
        logger.warn('CAPTCHA action mismatch', {
          expected: expectedAction,
          received: result.action
        });
        return {
          success: false,
          'error-codes': ['action-mismatch']
        };
      }

      // Check score (reCAPTCHA v3 returns a score from 0.0 to 1.0)
      if (result.score !== undefined && result.score < this.minScore) {
        logger.warn('CAPTCHA score too low', {
          score: result.score,
          minScore: this.minScore
        });
        return {
          success: false,
          score: result.score,
          'error-codes': ['score-too-low']
        };
      }

      return result;
    } catch (error) {
      logger.error('CAPTCHA verification error:', error);

      // In case of error, decide whether to fail open or closed
      // For production, you might want to fail closed (return false)
      // For development/staging, failing open might be better
      if (process.env.NODE_ENV === 'production') {
        return {
          success: false,
          'error-codes': ['verification-error']
        };
      } else {
        logger.warn('CAPTCHA verification error in non-production, allowing request');
        return {
          success: true,
          score: 0.5
        };
      }
    }
  }

  /**
   * Middleware-friendly verification
   */
  async verify(
    token: string,
    action?: string,
    ip?: string
  ): Promise<{ valid: boolean; message?: string }> {
    const result = await this.verifyToken(token, action, ip);

    if (!result.success) {
      const errorCode = result['error-codes']?.[0];
      let message = 'CAPTCHA verification failed';

      switch (errorCode) {
        case 'missing-input-response':
          message = 'CAPTCHA token is missing';
          break;
        case 'invalid-input-response':
          message = 'CAPTCHA token is invalid or has expired';
          break;
        case 'score-too-low':
          message = 'CAPTCHA verification failed. Please try again.';
          break;
        case 'action-mismatch':
          message = 'CAPTCHA action mismatch';
          break;
        case 'timeout-or-duplicate':
          message = 'CAPTCHA token has expired or was already used';
          break;
        default:
          message = 'CAPTCHA verification failed';
      }

      return { valid: false, message };
    }

    return { valid: true };
  }

  /**
   * Check if CAPTCHA is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}

// Export singleton instance
export const captchaService = new CaptchaService();
