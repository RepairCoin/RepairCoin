// backend/src/routes/upload.ts
import express, { Request, Response } from 'express';
import multer from 'multer';
import { imageStorageService } from '../services/ImageStorageService';
import { authMiddleware, requireRole } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = express.Router();

// Configure multer for memory storage (files stored in buffer)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
  },
  fileFilter: (_req, file, cb) => {
    // Allow only image files
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.'));
    }
  },
});

/**
 * Upload shop logo
 * POST /api/upload/shop-logo
 * Requires: Shop role
 */
router.post('/shop-logo', authMiddleware, requireRole(['shop']), upload.single('image'), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    const shopId = req.user?.shopId;

    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'No image file provided',
      });
    }

    if (!shopId) {
      return res.status(403).json({
        success: false,
        error: 'Shop ID not found in authentication token',
      });
    }

    const result = await imageStorageService.uploadShopLogo(file, shopId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    logger.info('Shop logo uploaded successfully', { shopId, url: result.url });

    res.json(result);
  } catch (error) {
    logger.error('Error uploading shop logo:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload shop logo',
    });
  }
});

/**
 * Upload service image
 * POST /api/upload/service-image
 * Requires: Shop role
 */
router.post('/service-image', authMiddleware, requireRole(['shop']), upload.single('image'), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    const shopId = req.user?.shopId;

    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'No image file provided',
      });
    }

    if (!shopId) {
      return res.status(403).json({
        success: false,
        error: 'Shop ID not found in authentication token',
      });
    }

    const result = await imageStorageService.uploadServiceImage(file, shopId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    logger.info('Service image uploaded successfully', { shopId, url: result.url });

    res.json(result);
  } catch (error) {
    logger.error('Error uploading service image:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload service image',
    });
  }
});

/**
 * Upload shop banner
 * POST /api/upload/shop-banner
 * Requires: Shop role
 */
router.post('/shop-banner', authMiddleware, requireRole(['shop']), upload.single('image'), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    const shopId = req.user?.shopId;

    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'No image file provided',
      });
    }

    if (!shopId) {
      return res.status(403).json({
        success: false,
        error: 'Shop ID not found in authentication token',
      });
    }

    const result = await imageStorageService.uploadShopBanner(file, shopId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    logger.info('Shop banner uploaded successfully', { shopId, url: result.url });

    res.json(result);
  } catch (error) {
    logger.error('Error uploading shop banner:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload shop banner',
    });
  }
});

/**
 * Delete image
 * DELETE /api/upload/:key
 * Requires: Shop role
 */
router.delete('/:key(*)', authMiddleware, requireRole(['shop']), async (req: Request, res: Response) => {
  try {
    const key = req.params.key;
    const shopId = req.user?.shopId;

    if (!key) {
      return res.status(400).json({
        success: false,
        error: 'Image key not provided',
      });
    }

    // Verify that the key belongs to this shop
    if (!key.includes(`shops/${shopId}`)) {
      return res.status(403).json({
        success: false,
        error: 'You can only delete images from your own shop',
      });
    }

    const success = await imageStorageService.deleteImage(key);

    if (!success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to delete image',
      });
    }

    logger.info('Image deleted successfully', { shopId, key });

    res.json({
      success: true,
      message: 'Image deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting image:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete image',
    });
  }
});

/**
 * Get presigned URL for temporary access
 * GET /api/upload/presigned/:key
 * Requires: Authentication
 */
router.get('/presigned/:key(*)', authMiddleware, async (req: Request, res: Response) => {
  try {
    const key = req.params.key;
    const expiresIn = parseInt(req.query.expiresIn as string) || 3600; // Default 1 hour

    if (!key) {
      return res.status(400).json({
        success: false,
        error: 'Image key not provided',
      });
    }

    const url = await imageStorageService.getPresignedUrl(key, expiresIn);

    res.json({
      success: true,
      url,
      expiresIn,
    });
  } catch (error) {
    logger.error('Error generating presigned URL:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate presigned URL',
    });
  }
});

export default router;
