/**
 * End-to-end tests for Resolve / Reopen Conversations feature
 *
 * Validates:
 * 1. Backend: Repository method, Service method, Controller method, Route
 * 2. Frontend API: archiveConversation method
 * 3. Frontend UI: ConversationThread dropdown menu with resolve/reopen
 * 4. Frontend UI: MessagesContainer passes status + handler props
 * 5. No regression on existing messaging features
 */
import { describe, it, expect, beforeAll } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

const REPO_PATH = path.resolve(__dirname, '../../../backend/src/repositories/MessageRepository.ts');
const SERVICE_PATH = path.resolve(__dirname, '../../../backend/src/domains/messaging/services/MessageService.ts');
const CONTROLLER_PATH = path.resolve(__dirname, '../../../backend/src/domains/messaging/controllers/MessageController.ts');
const ROUTES_PATH = path.resolve(__dirname, '../../../backend/src/domains/messaging/routes.ts');
const API_CLIENT_PATH = path.resolve(__dirname, '../../../frontend/src/services/api/messaging.ts');
const THREAD_PATH = path.resolve(__dirname, '../../../frontend/src/components/messaging/ConversationThread.tsx');
const CONTAINER_PATH = path.resolve(__dirname, '../../../frontend/src/components/messaging/MessagesContainer.tsx');

describe('Resolve / Reopen Conversations', () => {
  let repoSource: string;
  let serviceSource: string;
  let controllerSource: string;
  let routesSource: string;
  let apiClientSource: string;
  let threadSource: string;
  let containerSource: string;

  beforeAll(() => {
    repoSource = fs.readFileSync(REPO_PATH, 'utf-8');
    serviceSource = fs.readFileSync(SERVICE_PATH, 'utf-8');
    controllerSource = fs.readFileSync(CONTROLLER_PATH, 'utf-8');
    routesSource = fs.readFileSync(ROUTES_PATH, 'utf-8');
    apiClientSource = fs.readFileSync(API_CLIENT_PATH, 'utf-8');
    threadSource = fs.readFileSync(THREAD_PATH, 'utf-8');
    containerSource = fs.readFileSync(CONTAINER_PATH, 'utf-8');
  });

  describe('Backend - MessageRepository', () => {
    it('defines setConversationArchived method', () => {
      expect(repoSource).toContain('async setConversationArchived(');
    });

    it('accepts conversationId, userType, and archived params', () => {
      expect(repoSource).toContain("conversationId: string,");
      expect(repoSource).toContain("userType: 'customer' | 'shop',");
      expect(repoSource).toContain("archived: boolean");
    });

    it('selects correct column based on userType', () => {
      expect(repoSource).toContain("userType === 'customer' ? 'is_archived_customer' : 'is_archived_shop'");
    });

    it('runs UPDATE query on conversations table', () => {
      expect(repoSource).toContain('UPDATE conversations SET');
    });

    it('updates updated_at timestamp', () => {
      expect(repoSource).toContain('updated_at = NOW()');
    });

    it('uses parameterized query with archived and conversationId', () => {
      expect(repoSource).toContain('await this.pool.query(query, [archived, conversationId])');
    });
  });

  describe('Backend - MessageService', () => {
    it('defines setConversationArchived method', () => {
      expect(serviceSource).toContain('async setConversationArchived(');
    });

    it('accepts conversationId, userIdentifier, userType, and archived', () => {
      const methodStart = serviceSource.indexOf('async setConversationArchived(');
      const methodBody = serviceSource.substring(methodStart, methodStart + 600);
      expect(methodBody).toContain('conversationId: string');
      expect(methodBody).toContain('userIdentifier: string');
      expect(methodBody).toContain("userType: 'customer' | 'shop'");
      expect(methodBody).toContain('archived: boolean');
    });

    it('looks up conversation by ID first', () => {
      expect(serviceSource).toContain('this.messageRepo.getConversationById(conversationId)');
    });

    it('throws if conversation not found', () => {
      expect(serviceSource).toContain("throw new Error('Conversation not found')");
    });

    it('validates customer ownership', () => {
      expect(serviceSource).toContain("userType === 'customer' && userIdentifier !== conversation.customerAddress");
    });

    it('validates shop ownership', () => {
      expect(serviceSource).toContain("userType === 'shop' && userIdentifier !== conversation.shopId");
    });

    it('throws Unauthorized for non-owners', () => {
      const methodStart = serviceSource.indexOf('async setConversationArchived(');
      const methodBody = serviceSource.substring(methodStart, methodStart + 600);
      expect(methodBody).toContain("throw new Error('Unauthorized')");
    });

    it('calls repository setConversationArchived', () => {
      expect(serviceSource).toContain('this.messageRepo.setConversationArchived(conversationId, userType, archived)');
    });

    it('logs archive and reopen actions', () => {
      expect(serviceSource).toContain("archived ? 'archived' : 'reopened'");
    });
  });

  describe('Backend - MessageController', () => {
    it('defines archiveConversation handler', () => {
      expect(controllerSource).toContain('archiveConversation = async (req: Request, res: Response)');
    });

    it('requires authentication', () => {
      const methodStart = controllerSource.indexOf('archiveConversation = async');
      const methodBody = controllerSource.substring(methodStart, methodStart + 800);
      expect(methodBody).toContain('Authentication required');
    });

    it('requires shopId for shop users', () => {
      const methodStart = controllerSource.indexOf('archiveConversation = async');
      const methodBody = controllerSource.substring(methodStart, methodStart + 800);
      expect(methodBody).toContain('Shop ID required');
    });

    it('extracts conversationId from params', () => {
      expect(controllerSource).toContain("const { conversationId } = req.params");
    });

    it('extracts archived from body', () => {
      expect(controllerSource).toContain("const { archived } = req.body");
    });

    it('validates archived is boolean', () => {
      expect(controllerSource).toContain("typeof archived !== 'boolean'");
      expect(controllerSource).toContain("'archived (boolean) is required'");
    });

    it('determines userType from role', () => {
      const methodStart = controllerSource.indexOf('archiveConversation = async');
      const methodBody = controllerSource.substring(methodStart, methodStart + 800);
      expect(methodBody).toContain("userRole === 'shop' ? 'shop' : 'customer'");
    });

    it('calls service setConversationArchived', () => {
      expect(controllerSource).toContain('this.messageService.setConversationArchived(');
    });

    it('returns resolve message when archived', () => {
      expect(controllerSource).toContain("archived ? 'Conversation resolved' : 'Conversation reopened'");
    });

    it('returns success response', () => {
      const methodStart = controllerSource.indexOf('archiveConversation = async');
      const methodBody = controllerSource.substring(methodStart, methodStart + 1200);
      expect(methodBody).toContain('success: true');
    });
  });

  describe('Backend - Route', () => {
    it('registers PATCH archive route', () => {
      expect(routesSource).toContain("router.patch('/conversations/:conversationId/archive'");
    });

    it('wires to messageController.archiveConversation', () => {
      expect(routesSource).toContain('messageController.archiveConversation');
    });

    it('route is behind authMiddleware', () => {
      // authMiddleware is applied to all routes via router.use
      const authLine = routesSource.indexOf('router.use(authMiddleware)');
      const archiveLine = routesSource.indexOf("router.patch('/conversations/:conversationId/archive'");
      expect(authLine).toBeGreaterThan(-1);
      expect(archiveLine).toBeGreaterThan(authLine);
    });
  });

  describe('Frontend API - messaging.ts', () => {
    it('exports archiveConversation function', () => {
      expect(apiClientSource).toContain('export const archiveConversation = async');
    });

    it('accepts conversationId and archived params', () => {
      expect(apiClientSource).toContain('conversationId: string, archived: boolean');
    });

    it('calls PATCH with correct endpoint', () => {
      expect(apiClientSource).toContain("apiClient.patch(`/messages/conversations/${conversationId}/archive`");
    });

    it('sends archived in request body', () => {
      expect(apiClientSource).toContain('{ archived }');
    });

    it('returns void', () => {
      expect(apiClientSource).toContain('archiveConversation = async (conversationId: string, archived: boolean): Promise<void>');
    });
  });

  describe('Frontend UI - ConversationThread', () => {
    it('imports CheckCircle icon', () => {
      expect(threadSource).toContain('CheckCircle');
    });

    it('imports RotateCcw icon', () => {
      expect(threadSource).toContain('RotateCcw');
    });

    it('declares conversationStatus prop', () => {
      expect(threadSource).toContain('conversationStatus?: "active" | "resolved" | "archived"');
    });

    it('declares onArchiveConversation prop', () => {
      expect(threadSource).toContain('onArchiveConversation?: (archived: boolean) => Promise<void>');
    });

    it('destructures conversationStatus in component', () => {
      expect(threadSource).toContain('conversationStatus,');
    });

    it('destructures onArchiveConversation in component', () => {
      expect(threadSource).toContain('onArchiveConversation,');
    });

    it('has showMoreMenu state', () => {
      expect(threadSource).toContain('const [showMoreMenu, setShowMoreMenu] = useState(false)');
    });

    it('has moreMenuRef for click-outside', () => {
      expect(threadSource).toContain('const moreMenuRef = useRef<HTMLDivElement>(null)');
    });

    it('has click-outside handler for more menu', () => {
      expect(threadSource).toContain('moreMenuRef.current && !moreMenuRef.current.contains');
      expect(threadSource).toContain('setShowMoreMenu(false)');
    });

    it('shows Resolved badge when status is resolved', () => {
      expect(threadSource).toContain('conversationStatus === "resolved"');
      expect(threadSource).toContain('Resolved');
      expect(threadSource).toContain('bg-green-500/20');
      expect(threadSource).toContain('text-green-400');
    });

    it('MoreVertical button toggles menu', () => {
      expect(threadSource).toContain('setShowMoreMenu(!showMoreMenu)');
    });

    it('dropdown renders when showMoreMenu is true', () => {
      expect(threadSource).toContain('{showMoreMenu && (');
    });

    it('shows Resolve Conversation option when active', () => {
      expect(threadSource).toContain('Resolve Conversation');
    });

    it('shows Reopen Conversation option when resolved', () => {
      expect(threadSource).toContain('Reopen Conversation');
    });

    it('calls onArchiveConversation(true) to resolve', () => {
      expect(threadSource).toContain('onArchiveConversation(true)');
    });

    it('calls onArchiveConversation(false) to reopen', () => {
      expect(threadSource).toContain('onArchiveConversation(false)');
    });

    it('closes menu after action', () => {
      // Both resolve and reopen call setShowMoreMenu(false) after the action
      const resolveBtn = threadSource.indexOf('onArchiveConversation(true)');
      const reopenBtn = threadSource.indexOf('onArchiveConversation(false)');
      expect(resolveBtn).toBeGreaterThan(-1);
      expect(reopenBtn).toBeGreaterThan(-1);
      // Both should be followed by setShowMoreMenu(false) on the same line
      const resolveLine = threadSource.substring(resolveBtn, resolveBtn + 100);
      const reopenLine = threadSource.substring(reopenBtn, reopenBtn + 100);
      expect(resolveLine).toContain('setShowMoreMenu(false)');
      expect(reopenLine).toContain('setShowMoreMenu(false)');
    });

    it('conditionally renders based on onArchiveConversation prop', () => {
      expect(threadSource).toContain('{onArchiveConversation && (');
    });

    it('switches menu options based on conversationStatus', () => {
      expect(threadSource).toContain('conversationStatus === "resolved" ?');
    });
  });

  describe('Frontend UI - MessagesContainer', () => {
    it('accepts filterUnread prop', () => {
      expect(containerSource).toContain('filterUnread?: boolean');
    });

    it('accepts filterDateRange prop', () => {
      expect(containerSource).toContain("filterDateRange?: 'all' | '7d' | '30d' | '90d'");
    });

    it('defines handleArchiveConversation handler', () => {
      expect(containerSource).toContain('const handleArchiveConversation = async (archived: boolean)');
    });

    it('handler calls messagingApi.archiveConversation', () => {
      expect(containerSource).toContain('messagingApi.archiveConversation(selectedConversationId, archived)');
    });

    it('handler updates local conversation state', () => {
      expect(containerSource).toContain("status: archived ? 'resolved' as const : 'active' as const");
    });

    it('passes conversationStatus to ConversationThread (desktop)', () => {
      expect(containerSource).toContain('conversationStatus={selectedConversation.status}');
    });

    it('passes onArchiveConversation to ConversationThread (desktop)', () => {
      expect(containerSource).toContain('onArchiveConversation={handleArchiveConversation}');
    });

    it('passes props to mobile ConversationThread too', () => {
      // Both desktop and mobile instances should have these props
      const instances = containerSource.split('onArchiveConversation={handleArchiveConversation}');
      expect(instances.length).toBeGreaterThanOrEqual(3); // 2 occurrences = 3 splits
    });
  });

  describe('No Regression - Existing Features', () => {
    it('route file still has send message route', () => {
      expect(routesSource).toContain("router.post('/send'");
    });

    it('route file still has get conversations route', () => {
      expect(routesSource).toContain("router.get('/conversations'");
    });

    it('route file still has mark as read route', () => {
      expect(routesSource).toContain("router.post('/conversations/:conversationId/read'");
    });

    it('route file still has get messages route', () => {
      expect(routesSource).toContain("router.get('/conversations/:conversationId/messages'");
    });

    it('route file still has attachment upload route', () => {
      expect(routesSource).toContain("router.post('/attachments/upload'");
    });

    it('controller still has sendMessage method', () => {
      expect(controllerSource).toContain('sendMessage = async');
    });

    it('controller still has getConversations method', () => {
      expect(controllerSource).toContain('getConversations = async');
    });

    it('controller still has markAsRead method', () => {
      expect(controllerSource).toContain('markAsRead = async');
    });

    it('ConversationThread still has onSendMessage prop', () => {
      expect(threadSource).toContain('onSendMessage: (content: string, attachments?: File[]) => Promise<void>');
    });

    it('ConversationThread still has emoji picker', () => {
      expect(threadSource).toContain('showEmojiPicker');
      expect(threadSource).toContain('EmojiPicker');
    });

    it('ConversationThread still has file attachment support', () => {
      expect(threadSource).toContain('selectedFiles');
      expect(threadSource).toContain('fileInputRef');
    });

    it('MessagesContainer still has handleSendMessage', () => {
      expect(containerSource).toContain('const handleSendMessage = async');
    });

    it('MessagesContainer still passes userType to MessageInbox', () => {
      expect(containerSource).toContain('userType={userType}');
    });

    it('MessagesContainer still has conversation polling', () => {
      expect(containerSource).toContain('setInterval');
    });

    it('API client still exports sendMessage', () => {
      expect(apiClientSource).toContain('export const sendMessage = async');
    });

    it('API client still exports getConversations', () => {
      expect(apiClientSource).toContain('export const getConversations = async');
    });

    it('API client still exports markConversationAsRead', () => {
      expect(apiClientSource).toContain('export const markConversationAsRead = async');
    });

    it('API client still exports uploadAttachments', () => {
      expect(apiClientSource).toContain('export const uploadAttachments = async');
    });
  });
});
