/**
 * Tests for uploadAttachments controller method (Step 2)
 *
 * Validates:
 * 1. Controller method exists and has correct structure
 * 2. ImageStorageService.uploadFile method exists for images + PDF
 * 3. Response shape (attachments array with url, key, type, name, size, mimetype)
 * 4. Error handling (no files, all uploads failed, partial success)
 * 5. No regression on existing controller methods
 */
import { describe, it, expect, beforeAll } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

const CONTROLLER_PATH = path.resolve(
  __dirname,
  '../../src/domains/messaging/controllers/MessageController.ts'
);
const STORAGE_PATH = path.resolve(
  __dirname,
  '../../src/services/ImageStorageService.ts'
);

describe('Attachment Upload Controller - Step 2', () => {
  let controllerSource: string;
  let storageSource: string;

  beforeAll(() => {
    controllerSource = fs.readFileSync(CONTROLLER_PATH, 'utf-8');
    storageSource = fs.readFileSync(STORAGE_PATH, 'utf-8');
  });

  describe('Controller Method', () => {
    it('imports imageStorageService', () => {
      expect(controllerSource).toContain(
        "import { imageStorageService } from '../../../services/ImageStorageService'"
      );
    });

    it('has uploadAttachments method', () => {
      expect(controllerSource).toContain('uploadAttachments = async');
    });

    it('checks authentication', () => {
      // Extract the uploadAttachments method body
      const methodStart = controllerSource.indexOf('uploadAttachments = async');
      const nextMethod = controllerSource.indexOf(
        '/**',
        methodStart + 50
      );
      const methodBody = controllerSource.substring(methodStart, nextMethod);
      expect(methodBody).toContain('req.user?.address');
      expect(methodBody).toContain('Authentication required');
    });

    it('validates files are provided', () => {
      const methodStart = controllerSource.indexOf('uploadAttachments = async');
      const nextMethod = controllerSource.indexOf('/**', methodStart + 50);
      const methodBody = controllerSource.substring(methodStart, nextMethod);
      expect(methodBody).toContain('No files provided');
    });

    it('casts req.files as Express.Multer.File[]', () => {
      expect(controllerSource).toContain(
        'req.files as Express.Multer.File[]'
      );
    });

    it('calls imageStorageService.uploadFile for each file', () => {
      expect(controllerSource).toContain('imageStorageService.uploadFile');
    });

    it('uses Promise.all for parallel uploads', () => {
      expect(controllerSource).toContain('Promise.all');
    });

    it('uploads to messages/attachments folder', () => {
      expect(controllerSource).toContain("'messages/attachments'");
    });

    it('returns attachment objects with url field', () => {
      const methodStart = controllerSource.indexOf('uploadAttachments = async');
      const nextMethod = controllerSource.indexOf('/**', methodStart + 50);
      const methodBody = controllerSource.substring(methodStart, nextMethod);
      expect(methodBody).toContain('url: result.url');
    });

    it('returns attachment objects with key field', () => {
      const methodStart = controllerSource.indexOf('uploadAttachments = async');
      const nextMethod = controllerSource.indexOf('/**', methodStart + 50);
      const methodBody = controllerSource.substring(methodStart, nextMethod);
      expect(methodBody).toContain('key: result.key');
    });

    it('determines type as image or file based on mimetype', () => {
      expect(controllerSource).toContain(
        "file.mimetype.startsWith('image/') ? 'image' : 'file'"
      );
    });

    it('includes original filename in response', () => {
      const methodStart = controllerSource.indexOf('uploadAttachments = async');
      const nextMethod = controllerSource.indexOf('/**', methodStart + 50);
      const methodBody = controllerSource.substring(methodStart, nextMethod);
      expect(methodBody).toContain('name: file.originalname');
    });

    it('includes file size in response', () => {
      const methodStart = controllerSource.indexOf('uploadAttachments = async');
      const nextMethod = controllerSource.indexOf('/**', methodStart + 50);
      const methodBody = controllerSource.substring(methodStart, nextMethod);
      expect(methodBody).toContain('size: file.size');
    });

    it('includes mimetype in response', () => {
      const methodStart = controllerSource.indexOf('uploadAttachments = async');
      const nextMethod = controllerSource.indexOf('/**', methodStart + 50);
      const methodBody = controllerSource.substring(methodStart, nextMethod);
      expect(methodBody).toContain('mimetype: file.mimetype');
    });

    it('handles all uploads failing', () => {
      expect(controllerSource).toContain('All file uploads failed');
    });

    it('reports warnings for partial failures', () => {
      expect(controllerSource).toContain("file(s) failed to upload");
    });

    it('filters out null results from failed uploads', () => {
      expect(controllerSource).toContain('.filter(Boolean)');
    });

    it('has error handling with try/catch', () => {
      const methodStart = controllerSource.indexOf('uploadAttachments = async');
      const nextMethod = controllerSource.indexOf('/**', methodStart + 50);
      const methodBody = controllerSource.substring(methodStart, nextMethod);
      expect(methodBody).toContain('try {');
      expect(methodBody).toContain('} catch');
    });

    it('logs errors', () => {
      expect(controllerSource).toContain(
        'Error in uploadAttachments controller'
      );
    });
  });

  describe('ImageStorageService.uploadFile', () => {
    it('has uploadFile method', () => {
      expect(storageSource).toContain('async uploadFile(');
    });

    it('accepts images and PDF', () => {
      // Extract uploadFile method
      const methodStart = storageSource.indexOf('async uploadFile(');
      const methodEnd = storageSource.indexOf(
        'async uploadShopLogo',
        methodStart
      );
      const methodBody = storageSource.substring(methodStart, methodEnd);
      expect(methodBody).toContain("'image/jpeg'");
      expect(methodBody).toContain("'image/png'");
      expect(methodBody).toContain("'image/gif'");
      expect(methodBody).toContain("'image/webp'");
      expect(methodBody).toContain("'application/pdf'");
    });

    it('validates file size (5MB)', () => {
      const methodStart = storageSource.indexOf('async uploadFile(');
      const methodEnd = storageSource.indexOf(
        'async uploadShopLogo',
        methodStart
      );
      const methodBody = storageSource.substring(methodStart, methodEnd);
      expect(methodBody).toMatch(/5\s*\*\s*1024\s*\*\s*1024/);
    });

    it('uses file.mimetype as ContentType (not extension lookup)', () => {
      const methodStart = storageSource.indexOf('async uploadFile(');
      const methodEnd = storageSource.indexOf(
        'async uploadShopLogo',
        methodStart
      );
      const methodBody = storageSource.substring(methodStart, methodEnd);
      expect(methodBody).toContain('ContentType: contentType');
      expect(methodBody).toContain('const contentType = file.mimetype');
    });

    it('sets ACL to public-read', () => {
      const methodStart = storageSource.indexOf('async uploadFile(');
      const methodEnd = storageSource.indexOf(
        'async uploadShopLogo',
        methodStart
      );
      const methodBody = storageSource.substring(methodStart, methodEnd);
      expect(methodBody).toContain("ACL: 'public-read'");
    });

    it('returns UploadResult with success, url, key', () => {
      const methodStart = storageSource.indexOf('async uploadFile(');
      const methodEnd = storageSource.indexOf(
        'async uploadShopLogo',
        methodStart
      );
      const methodBody = storageSource.substring(methodStart, methodEnd);
      expect(methodBody).toContain('success: true');
      expect(methodBody).toContain('url: publicUrl');
      expect(methodBody).toContain('key: fileName');
    });

    it('has error handling', () => {
      const methodStart = storageSource.indexOf('async uploadFile(');
      const methodEnd = storageSource.indexOf(
        'async uploadShopLogo',
        methodStart
      );
      const methodBody = storageSource.substring(methodStart, methodEnd);
      expect(methodBody).toContain('success: false');
      expect(methodBody).toContain('Failed to upload file');
    });

    it('default folder is files', () => {
      // Method signature spans multiple lines, so check the default value separately
      const methodStart = storageSource.indexOf('async uploadFile(');
      const methodEnd = storageSource.indexOf('async uploadShopLogo', methodStart);
      const methodBody = storageSource.substring(methodStart, methodEnd);
      expect(methodBody).toContain("= 'files'");
    });
  });

  describe('No Regression - Existing Controller Methods', () => {
    it('sendMessage method still exists', () => {
      expect(controllerSource).toContain('sendMessage = async');
    });

    it('getConversations method still exists', () => {
      expect(controllerSource).toContain('getConversations = async');
    });

    it('getMessages method still exists', () => {
      expect(controllerSource).toContain('getMessages = async');
    });

    it('markAsRead method still exists', () => {
      expect(controllerSource).toContain('markAsRead = async');
    });

    it('getUnreadCount method still exists', () => {
      expect(controllerSource).toContain('getUnreadCount = async');
    });

    it('getOrCreateConversation method still exists', () => {
      expect(controllerSource).toContain('getOrCreateConversation = async');
    });

    it('getQuickReplies method still exists', () => {
      expect(controllerSource).toContain('getQuickReplies = async');
    });

    it('still imports MessageService', () => {
      expect(controllerSource).toContain("import { MessageService }");
    });

    it('still imports QuickReplyRepository', () => {
      expect(controllerSource).toContain("import { QuickReplyRepository }");
    });
  });

  describe('No Regression - ImageStorageService', () => {
    it('uploadImage method still exists', () => {
      expect(storageSource).toContain('async uploadImage(');
    });

    it('uploadShopLogo method still exists', () => {
      expect(storageSource).toContain('async uploadShopLogo(');
    });

    it('uploadServiceImage method still exists', () => {
      expect(storageSource).toContain('async uploadServiceImage(');
    });

    it('singleton export still exists', () => {
      expect(storageSource).toContain(
        'export const imageStorageService = new ImageStorageService()'
      );
    });
  });
});
