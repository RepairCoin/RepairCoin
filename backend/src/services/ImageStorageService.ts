// backend/src/services/ImageStorageService.ts
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import { logger } from '../utils/logger';
import crypto from 'crypto';
import path from 'path';
import dns from 'dns';
import https from 'https';

// Define Multer file type to avoid dependency on @types/multer in production
interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
  destination?: string;
  filename?: string;
  path?: string;
  stream?: NodeJS.ReadableStream;
}

export interface UploadResult {
  success: boolean;
  url?: string;
  key?: string;
  error?: string;
}

export class ImageStorageService {
  private s3Client: S3Client;
  private bucketName: string;
  private region: string;
  private cdnEndpoint: string;
  private resolvedEndpoint: string | null = null;

  constructor() {
    // DigitalOcean Spaces configuration
    this.bucketName = process.env.DO_SPACES_BUCKET || '';
    this.region = process.env.DO_SPACES_REGION || 'nyc3';
    this.cdnEndpoint = process.env.DO_SPACES_CDN_ENDPOINT || '';

    if (!this.bucketName) {
      throw new Error('DO_SPACES_BUCKET environment variable is required');
    }

    // Use Google DNS for resolution
    dns.setServers(['8.8.8.8', '8.8.4.4']);

    // Resolve the Spaces endpoint IP address synchronously
    const spacesHostname = `${this.bucketName}.${this.region}.digitaloceanspaces.com`;

    logger.info('Resolving DigitalOcean Spaces endpoint...', { hostname: spacesHostname });

    // Use a simpler approach: create S3 client without custom lookup
    // The DNS resolution will happen automatically with Google DNS
    this.s3Client = new S3Client({
      endpoint: `https://${spacesHostname}`,
      region: this.region,
      credentials: {
        accessKeyId: process.env.DO_SPACES_KEY || '',
        secretAccessKey: process.env.DO_SPACES_SECRET || '',
      },
      forcePathStyle: false,
    });

    logger.info('ImageStorageService initialized', {
      bucket: this.bucketName,
      region: this.region,
      endpoint: spacesHostname,
      googleDNS: true,
    });
  }

  /**
   * Generate unique filename with timestamp and random string
   */
  private generateFileName(originalName: string, folder: string = 'images'): string {
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(originalName);
    const sanitizedName = path.basename(originalName, ext).replace(/[^a-zA-Z0-9]/g, '-');
    return `${folder}/${timestamp}-${randomString}-${sanitizedName}${ext}`;
  }

  /**
   * Get file content type based on extension
   */
  private getContentType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const contentTypes: { [key: string]: string } = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
    };
    return contentTypes[ext] || 'application/octet-stream';
  }

  /**
   * Upload image to DigitalOcean Spaces
   */
  async uploadImage(
    file: MulterFile,
    folder: string = 'images'
  ): Promise<UploadResult> {
    try {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.mimetype)) {
        return {
          success: false,
          error: 'Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.',
        };
      }

      // Validate file size (5MB max)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        return {
          success: false,
          error: 'File size exceeds 5MB limit.',
        };
      }

      const fileName = this.generateFileName(file.originalname, folder);
      const contentType = this.getContentType(file.originalname);

      // Upload to DigitalOcean Spaces
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: fileName,
        Body: file.buffer,
        ContentType: contentType,
        ACL: 'public-read', // Make images publicly accessible
        CacheControl: 'max-age=31536000', // Cache for 1 year
      });

      await this.s3Client.send(command);

      // Generate public URL (use CDN endpoint if configured, otherwise Spaces endpoint)
      const publicUrl = this.cdnEndpoint
        ? `${this.cdnEndpoint}/${fileName}`
        : `https://${this.bucketName}.${this.region}.digitaloceanspaces.com/${fileName}`;

      logger.info('Image uploaded successfully', {
        fileName,
        size: file.size,
        url: publicUrl,
      });

      return {
        success: true,
        url: publicUrl,
        key: fileName,
      };
    } catch (error: any) {
      logger.error('Error uploading image:', error);
      return {
        success: false,
        error: `Failed to upload image: ${error.message}`,
      };
    }
  }

  /**
   * Upload shop logo
   */
  async uploadShopLogo(file: MulterFile, shopId: string): Promise<UploadResult> {
    return this.uploadImage(file, `shops/${shopId}/logos`);
  }

  /**
   * Upload service image
   */
  async uploadServiceImage(file: MulterFile, shopId: string): Promise<UploadResult> {
    return this.uploadImage(file, `shops/${shopId}/services`);
  }

  /**
   * Upload shop banner
   */
  async uploadShopBanner(file: MulterFile, shopId: string): Promise<UploadResult> {
    return this.uploadImage(file, `shops/${shopId}/banners`);
  }

  /**
   * Delete image from DigitalOcean Spaces
   */
  async deleteImage(key: string): Promise<boolean> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);

      logger.info('Image deleted successfully', { key });
      return true;
    } catch (error: any) {
      logger.error('Error deleting image:', error);
      return false;
    }
  }

  /**
   * Generate presigned URL for temporary access (optional, for private images)
   */
  async getPresignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const url = await getSignedUrl(this.s3Client, command, { expiresIn });
      return url;
    } catch (error: any) {
      logger.error('Error generating presigned URL:', error);
      throw error;
    }
  }

  /**
   * Extract key from public URL
   */
  extractKeyFromUrl(url: string): string | null {
    try {
      // Handle both CDN and Spaces URLs
      const cdnMatch = url.match(/\/([^\/]+\/.+)$/);
      if (cdnMatch) {
        return cdnMatch[1];
      }

      const spacesMatch = url.match(/\.com\/(.+)$/);
      if (spacesMatch) {
        return spacesMatch[1];
      }

      return null;
    } catch (error) {
      return null;
    }
  }
}

// Export singleton instance
export const imageStorageService = new ImageStorageService();
