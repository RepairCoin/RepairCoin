// backend/src/domains/InventoryDomain/controllers/uploadController.ts
import { Request, Response } from 'express';
import { imageStorageService } from '../../../services/ImageStorageService';
import { logger } from '../../../utils/logger';
import multer from 'multer';

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    // Only allow images
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'));
    }
  },
});

// Middleware for single image upload
export const uploadSingleImage = upload.single('image');

/**
 * Upload inventory item image to Digital Ocean Spaces
 */
export const uploadInventoryImage = async (req: Request, res: Response): Promise<void> => {
  try {
    const shopId = req.user?.shopId;
    if (!shopId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'No image file provided' });
      return;
    }

    // Upload to Digital Ocean Spaces
    const result = await imageStorageService.uploadImage(
      req.file,
      `shops/${shopId}/inventory`
    );

    if (!result.success) {
      res.status(500).json({ error: result.error || 'Failed to upload image' });
      return;
    }

    logger.info('Inventory image uploaded successfully', {
      shopId,
      url: result.url,
      key: result.key,
    });

    res.json({
      url: result.url,
      key: result.key,
    });
  } catch (error: any) {
    logger.error('Error uploading inventory image:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
};
