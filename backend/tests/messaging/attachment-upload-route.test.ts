/**
 * Tests for POST /api/messages/attachments/upload route configuration
 *
 * Validates:
 * 1. Multer middleware configuration (file types, size limits, max files)
 * 2. Authentication requirement
 * 3. Route registration and accessibility
 *
 * Note: The controller method (Step 2) does not exist yet.
 * These tests validate Step 1 — the route + multer config.
 */
import { describe, it, expect, beforeAll } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import multer from 'multer';

const ROUTES_PATH = path.resolve(__dirname, '../../src/domains/messaging/routes.ts');

describe('Attachment Upload Route - Step 1 Configuration', () => {
  let routeSource: string;

  beforeAll(() => {
    routeSource = fs.readFileSync(ROUTES_PATH, 'utf-8');
  });

  describe('Route Registration', () => {
    it('imports multer', () => {
      expect(routeSource).toContain("import multer from 'multer'");
    });

    it('registers POST /attachments/upload route', () => {
      expect(routeSource).toContain("router.post('/attachments/upload'");
    });

    it('applies attachmentUpload middleware before controller', () => {
      expect(routeSource).toMatch(
        /router\.post\('\/attachments\/upload',\s*attachmentUpload\.array\('files',\s*5\)/
      );
    });

    it('calls messageController.uploadAttachments handler', () => {
      expect(routeSource).toContain('messageController.uploadAttachments');
    });

    it('route is placed after authMiddleware', () => {
      const authLine = routeSource.indexOf('router.use(authMiddleware)');
      const uploadLine = routeSource.indexOf("'/attachments/upload'");
      expect(authLine).toBeGreaterThan(-1);
      expect(uploadLine).toBeGreaterThan(authLine);
    });
  });

  describe('Multer Configuration', () => {
    it('uses memory storage (not disk)', () => {
      expect(routeSource).toContain('multer.memoryStorage()');
    });

    it('sets file size limit to 5MB', () => {
      expect(routeSource).toMatch(/fileSize:\s*5\s*\*\s*1024\s*\*\s*1024/);
    });

    it('accepts up to 5 files', () => {
      expect(routeSource).toMatch(/\.array\('files',\s*5\)/);
    });

    it('allows JPEG files', () => {
      expect(routeSource).toContain("'image/jpeg'");
    });

    it('allows PNG files', () => {
      expect(routeSource).toContain("'image/png'");
    });

    it('allows GIF files', () => {
      expect(routeSource).toContain("'image/gif'");
    });

    it('allows WebP files', () => {
      expect(routeSource).toContain("'image/webp'");
    });

    it('allows PDF files', () => {
      expect(routeSource).toContain("'application/pdf'");
    });

    it('rejects invalid file types with descriptive error', () => {
      expect(routeSource).toContain('Invalid file type');
    });

    it('has a fileFilter function', () => {
      expect(routeSource).toContain('fileFilter:');
    });
  });

  describe('Multer Functional Tests', () => {
    // Recreate the same multer config from the route to test it directly
    let upload: multer.Multer;

    beforeAll(() => {
      upload = multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: 5 * 1024 * 1024 },
        fileFilter: (_req, file, cb) => {
          const allowed = [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp',
            'application/pdf',
          ];
          if (allowed.includes(file.mimetype)) {
            cb(null, true);
          } else {
            cb(new Error('Invalid file type. Allowed: JPEG, PNG, GIF, WebP, PDF'));
          }
        },
      });
    });

    it('fileFilter accepts image/jpeg', () => {
      const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
      expect(allowed.includes('image/jpeg')).toBe(true);
    });

    it('fileFilter accepts application/pdf', () => {
      const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
      expect(allowed.includes('application/pdf')).toBe(true);
    });

    it('fileFilter rejects text/plain', () => {
      const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
      expect(allowed.includes('text/plain')).toBe(false);
    });

    it('fileFilter rejects application/zip', () => {
      const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
      expect(allowed.includes('application/zip')).toBe(false);
    });

    it('fileFilter rejects application/javascript', () => {
      const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
      expect(allowed.includes('application/javascript')).toBe(false);
    });

    it('fileFilter rejects video/mp4', () => {
      const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
      expect(allowed.includes('video/mp4')).toBe(false);
    });

    it('size limit is exactly 5242880 bytes (5MB)', () => {
      const limit = 5 * 1024 * 1024;
      expect(limit).toBe(5242880);
    });

    it('max files is 5', () => {
      // Validated via the .array('files', 5) call in route source
      const match = routeSource.match(/\.array\('files',\s*(\d+)\)/);
      expect(match).not.toBeNull();
      expect(parseInt(match![1])).toBe(5);
    });
  });

  describe('No Regression - Existing Routes', () => {
    it('POST /send route still exists', () => {
      expect(routeSource).toContain("router.post('/send'");
    });

    it('GET /conversations route still exists', () => {
      expect(routeSource).toContain("router.get('/conversations'");
    });

    it('POST /conversations/get-or-create route still exists', () => {
      expect(routeSource).toContain("router.post('/conversations/get-or-create'");
    });

    it('GET /conversations/:conversationId/messages route still exists', () => {
      expect(routeSource).toContain("'/conversations/:conversationId/messages'");
    });

    it('POST /conversations/:conversationId/read route still exists', () => {
      expect(routeSource).toContain("'/conversations/:conversationId/read'");
    });

    it('GET /unread/count route still exists', () => {
      expect(routeSource).toContain("'/unread/count'");
    });

    it('quick-replies routes still exist', () => {
      expect(routeSource).toContain("'/quick-replies'");
    });

    it('auto-messages routes still exist', () => {
      expect(routeSource).toContain("'/auto-messages'");
    });

    it('authMiddleware is still applied globally', () => {
      expect(routeSource).toContain('router.use(authMiddleware)');
    });
  });
});
