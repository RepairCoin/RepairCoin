# FEATURE: Message Attachments (Image & File Upload)

**Status:** Complete
**Priority:** Medium
**Type:** Feature (Messaging Enhancement)
**Created:** 2026-03-11

## Description

The paperclip (attachment) button in `ConversationThread.tsx` allows file selection and shows a local preview, but clicking Send **discards the files entirely**. No upload or storage happens. The full pipeline needs to be built.

## Current State

### What Works
- File input opens native file picker (images, PDF, DOC/DOCX)
- `selectedFiles` state stores selected files
- Preview UI renders thumbnails with remove buttons
- Send button enables when files are selected (even without text)
- DB column `messages.attachments` (JSONB, default `[]`) exists and is ready

### What's Broken
- `MessagesContainer.handleSendMessage()` accepts `attachments?: File[]` but **ignores it** — only sends `messageText`
- `SendMessageRequest` type has no `attachments` field
- `MessageController.sendMessage()` does not extract or process attachments from request body
- No multer middleware on messaging routes
- No file upload call in the send flow
- Backend `MessageService.sendMessage()` never writes to the `attachments` column

### Existing Upload Infrastructure (Reusable)
- **Multer**: Memory storage, 5MB limit, image-only filter — `backend/src/routes/upload.ts`
- **ImageStorageService**: DigitalOcean Spaces (S3-compatible) with CDN — `backend/src/services/ImageStorageService.ts`
  - Methods: `uploadImage(file, folder)` → `{ success, url, key }`
  - Supports: JPEG, PNG, GIF, WebP
  - CDN endpoint: `https://repaircoinstorage.sfo3.cdn.digitaloceanspaces.com`
- **Upload routes**: `/api/upload/shop-logo`, `/api/upload/service-image`, etc.
- **Packages installed**: `multer`, `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`

## Implementation Plan

### Phase 1: Backend — Upload Endpoint + Send Integration

#### Step 1: Add message attachment upload endpoint

**File:** `backend/src/domains/messaging/routes.ts`

Add a new route with multer middleware:

```typescript
import multer from 'multer';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: JPEG, PNG, GIF, WebP, PDF'));
    }
  },
});

// Upload message attachments (up to 5 files)
router.post('/attachments/upload', authMiddleware, upload.array('files', 5), messageController.uploadAttachments);
```

#### Step 2: Add uploadAttachments controller method

**File:** `backend/src/domains/messaging/controllers/MessageController.ts`

```typescript
uploadAttachments = async (req: Request, res: Response) => {
  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) {
    return res.status(400).json({ success: false, error: 'No files provided' });
  }

  const uploads = await Promise.all(
    files.map(file => imageStorageService.uploadImage(file, 'messages/attachments'))
  );

  const attachments = uploads
    .filter(u => u.success)
    .map(u => ({ url: u.url, key: u.key, type: file.mimetype.startsWith('image/') ? 'image' : 'file', name: file.originalname }));

  res.json({ success: true, data: attachments });
};
```

#### Step 3: Accept attachments in sendMessage

**File:** `backend/src/domains/messaging/controllers/MessageController.ts`

Add `attachments` to the destructured body and pass it through:

```typescript
const { conversationId, customerAddress, shopId, messageText, messageType, metadata, attachments } = req.body;
```

**File:** `backend/src/domains/messaging/services/MessageService.ts`

Pass `attachments` to the repository's insert query so it writes to the `messages.attachments` JSONB column.

### Phase 2: Frontend — Upload Flow + Display

#### Step 4: Add uploadAttachments API method

**File:** `frontend/src/services/api/messaging.ts`

```typescript
export interface MessageAttachment {
  url: string;
  key: string;
  type: 'image' | 'file';
  name: string;
}

export const uploadAttachments = async (files: File[]): Promise<MessageAttachment[]> => {
  const formData = new FormData();
  files.forEach(file => formData.append('files', file));
  const response = await apiClient.post('/messages/attachments/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};
```

#### Step 5: Wire upload into MessagesContainer.handleSendMessage

**File:** `frontend/src/components/messaging/MessagesContainer.tsx`

```typescript
const handleSendMessage = async (content: string, attachments?: File[]): Promise<void> => {
  if (!selectedConversationId || (!content.trim() && (!attachments || attachments.length === 0))) return;

  // Upload files first if any
  let uploadedAttachments: MessageAttachment[] = [];
  if (attachments && attachments.length > 0) {
    uploadedAttachments = await messagingApi.uploadAttachments(attachments);
  }

  const newMessage = await messagingApi.sendMessage({
    conversationId: selectedConversationId,
    messageText: content || '',
    messageType: 'text',
    attachments: uploadedAttachments,
  });
  // ... rest of existing logic
};
```

#### Step 6: Display attachments in message bubbles

**File:** `frontend/src/components/messaging/ConversationThread.tsx`

The attachment rendering already exists in the JSX (lines 353-372) — it checks `message.attachments` and renders images or file links. This just needs the data to flow through from the API response, which it will once the backend returns attachments in the message object.

### Phase 3: Polish

#### Step 7: Upload progress indicator

Add a loading state in `ConversationThread.tsx` while files are uploading (before the message is sent). Show a small progress bar or spinner on each file preview thumbnail.

#### Step 8: File size validation on frontend

Validate file size (5MB) before upload attempt. Show inline error if file exceeds limit.

## Files to Modify

| File | Action |
| ---- | ------ |
| `backend/src/domains/messaging/routes.ts` | Add multer + `/attachments/upload` route |
| `backend/src/domains/messaging/controllers/MessageController.ts` | Add `uploadAttachments` method, pass `attachments` in `sendMessage` |
| `backend/src/domains/messaging/services/MessageService.ts` | Pass attachments to repository insert |
| `backend/src/repositories/MessageRepository.ts` | Include `attachments` in INSERT query |
| `frontend/src/services/api/messaging.ts` | Add `uploadAttachments()`, update `SendMessageRequest` type |
| `frontend/src/components/messaging/MessagesContainer.tsx` | Upload files before sending, pass attachments |
| `frontend/src/components/messaging/ConversationThread.tsx` | Add upload progress, file size validation |

## Edge Cases

- **Empty message with attachments**: Allow sending attachments without text (update `!content.trim()` guard in both frontend and backend)
- **Upload failure**: If upload fails, show error but keep files in preview for retry
- **Mixed success**: If 3/5 files upload successfully, send with the 3 that worked, show error for the 2 that failed
- **File type mismatch**: Frontend accepts `image/*,.pdf,.doc,.docx` but backend only allows images + PDF — align both or extend backend
- **Large files**: Reject >5MB on frontend before upload attempt
- **Concurrent uploads**: Disable send button while uploading to prevent double-send
- **Message display**: Existing attachment rendering in ConversationThread handles images and files — verify it works with real data
- **CDN URLs**: Attachments stored as CDN URLs in JSONB — no presigned URLs needed for public images

## Effort

~3-4 hours (backend 1.5h, frontend 1.5h, testing 1h)
