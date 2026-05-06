// backend/tests/ai-agent/MessageServiceAIHook.test.ts
//
// Unit tests for the AI auto-reply hook in MessageService (Phase 3 Task 8).
// Verifies the hook fires (or doesn't) under the right conditions, and that
// AI failures never break the original message-send.
//
// All external collaborators (repos, AgentOrchestrator, WS, presence services)
// are mocked. No real DB, no real Anthropic call.

// ----- Mocks (hoisted by jest) -----

const mockHandleCustomerMessage = jest.fn();
jest.mock('../../src/domains/AIAgentDomain/services/AgentOrchestrator', () => ({
  AgentOrchestrator: jest.fn().mockImplementation(() => ({
    handleCustomerMessage: mockHandleCustomerMessage,
  })),
}));

const mockGetOrCreateConversation = jest.fn();
const mockGetConversationById = jest.fn();
const mockCreateMessage = jest.fn();
const mockIncrementUnreadCount = jest.fn();
jest.mock('../../src/repositories/MessageRepository', () => ({
  MessageRepository: jest.fn().mockImplementation(() => ({
    getOrCreateConversation: mockGetOrCreateConversation,
    getConversationById: mockGetConversationById,
    createMessage: mockCreateMessage,
    incrementUnreadCount: mockIncrementUnreadCount,
  })),
}));

// NotificationService is constructed in MessageService — stub it out so it
// doesn't try to reach a real DB.
jest.mock('../../src/domains/notification/services/NotificationService', () => ({
  NotificationService: jest.fn().mockImplementation(() => ({})),
}));

// Presence + cooldown services are imported as singletons. Stub their
// methods so the post-persist email/push branches noop.
jest.mock('../../src/services/ConversationPresenceService', () => ({
  conversationPresenceService: { isViewing: jest.fn().mockReturnValue(false) },
}));
jest.mock('../../src/services/EmailCooldownService', () => ({
  emailCooldownService: { shouldSend: jest.fn().mockReturnValue(false) },
}));

// shopRepository is dynamically imported inside sendMessage. Stub the module
// so the import resolves without hitting a real DB.
jest.mock('../../src/repositories', () => ({
  shopRepository: { getShop: jest.fn().mockResolvedValue(null) },
}));

import {
  MessageService,
  _resetOrchestratorForTests,
} from '../../src/domains/messaging/services/MessageService';

// ----- Helpers -----

const freshMockConversation = (overrides: any = {}) => ({
  conversationId: 'conv_abc',
  customerAddress: '0xcustomer',
  shopId: 'peanut',
  serviceId: 'srv_test',
  isBlocked: false,
  status: 'open',
  unreadCountCustomer: 0,
  unreadCountShop: 0,
  isArchivedCustomer: false,
  isArchivedShop: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const freshMockMessage = (overrides: any = {}) => ({
  messageId: 'msg_123',
  conversationId: 'conv_abc',
  senderAddress: '0xcustomer',
  senderType: 'customer' as const,
  messageText: 'Hi',
  messageType: 'text' as const,
  attachments: [],
  metadata: {},
  isEncrypted: false,
  isRead: false,
  isDelivered: true,
  isDeleted: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const makeWsManager = (): any => ({ sendToAddresses: jest.fn() });

// Wait for the setImmediate-scheduled hook to run.
const waitForMicrotasks = () =>
  new Promise<void>((resolve) => setImmediate(resolve));

// ----- Setup -----

beforeAll(() => {
  // AgentOrchestrator's lazy construction succeeds with the jest.mock above
  // (no real ANTHROPIC_API_KEY needed). Setting it anyway for safety in case
  // any downstream code reads the env var directly.
  process.env.ANTHROPIC_API_KEY = 'test-key';
});

beforeEach(() => {
  _resetOrchestratorForTests();
  mockHandleCustomerMessage.mockReset();
  mockGetOrCreateConversation.mockReset();
  mockGetConversationById.mockReset();
  mockCreateMessage.mockReset();
  mockIncrementUnreadCount.mockReset();

  mockHandleCustomerMessage.mockResolvedValue({
    outcome: 'ai_replied',
    aiMessageId: 'msg_ai_reply',
    costUsd: 0.001,
    latencyMs: 1500,
    model: 'claude-sonnet-4-6',
  });
  mockIncrementUnreadCount.mockResolvedValue(undefined);
});

// ----- Tests -----

describe('AI auto-reply hook — fires when conditions met', () => {
  it('fires for a customer message when conversation has serviceId and is not encrypted', async () => {
    mockGetOrCreateConversation.mockResolvedValue(freshMockConversation());
    mockCreateMessage.mockResolvedValue({
      message: freshMockMessage(),
      created: true,
    });

    const ws = makeWsManager();
    const svc = new MessageService();
    svc.setWebSocketManager(ws);

    await svc.sendMessage({
      customerAddress: '0xcustomer',
      shopId: 'peanut',
      serviceId: 'srv_test',
      senderIdentifier: '0xcustomer',
      senderType: 'customer',
      messageText: 'Hi, what is the price?',
    });

    await waitForMicrotasks();

    expect(mockHandleCustomerMessage).toHaveBeenCalledTimes(1);
    expect(mockHandleCustomerMessage.mock.calls[0][0]).toMatchObject({
      conversationId: 'conv_abc',
      customerAddress: '0xcustomer',
      shopId: 'peanut',
      serviceId: 'srv_test',
      customerMessageText: 'Hi, what is the price?',
    });
  });

  it('broadcasts WS to customer when orchestrator returns ai_replied', async () => {
    mockGetOrCreateConversation.mockResolvedValue(freshMockConversation());
    mockCreateMessage.mockResolvedValue({
      message: freshMockMessage(),
      created: true,
    });

    const ws = makeWsManager();
    const svc = new MessageService();
    svc.setWebSocketManager(ws);

    await svc.sendMessage({
      customerAddress: '0xcustomer',
      shopId: 'peanut',
      serviceId: 'srv_test',
      senderIdentifier: '0xcustomer',
      senderType: 'customer',
      messageText: 'Hi',
    });

    await waitForMicrotasks();

    // First WS broadcast is the customer-message-to-shop signal (sendMessage
    // does this synchronously). Second is the AI-reply-to-customer broadcast
    // from the hook. We just check the AI broadcast happened.
    const aiBroadcast = ws.sendToAddresses.mock.calls.find(
      (call: any[]) =>
        Array.isArray(call[0]) && call[0].includes('0xcustomer')
    );
    expect(aiBroadcast).toBeDefined();
    expect(aiBroadcast![1]).toEqual({
      type: 'message:new',
      payload: { conversationId: 'conv_abc' },
    });
  });
});

describe('AI auto-reply hook — does NOT fire', () => {
  it('skips for shop-sender messages', async () => {
    mockGetOrCreateConversation.mockResolvedValue(freshMockConversation());
    mockCreateMessage.mockResolvedValue({
      message: freshMockMessage({ senderType: 'shop' }),
      created: true,
    });

    const svc = new MessageService();
    svc.setWebSocketManager(makeWsManager());

    await svc.sendMessage({
      customerAddress: '0xcustomer',
      shopId: 'peanut',
      serviceId: 'srv_test',
      senderIdentifier: 'peanut',
      senderType: 'shop',
      messageText: 'Hello!',
    });

    await waitForMicrotasks();

    expect(mockHandleCustomerMessage).not.toHaveBeenCalled();
  });

  it('skips when message is encrypted', async () => {
    mockGetOrCreateConversation.mockResolvedValue(freshMockConversation());
    mockCreateMessage.mockResolvedValue({
      message: freshMockMessage({ isEncrypted: true }),
      created: true,
    });

    const svc = new MessageService();
    svc.setWebSocketManager(makeWsManager());

    await svc.sendMessage({
      customerAddress: '0xcustomer',
      shopId: 'peanut',
      serviceId: 'srv_test',
      senderIdentifier: '0xcustomer',
      senderType: 'customer',
      messageText: 'encrypted ciphertext',
      isEncrypted: true,
    });

    await waitForMicrotasks();

    expect(mockHandleCustomerMessage).not.toHaveBeenCalled();
  });

  it('skips when conversation has no serviceId', async () => {
    mockGetOrCreateConversation.mockResolvedValue(
      freshMockConversation({ serviceId: undefined })
    );
    mockCreateMessage.mockResolvedValue({
      message: freshMockMessage(),
      created: true,
    });

    const svc = new MessageService();
    svc.setWebSocketManager(makeWsManager());

    await svc.sendMessage({
      customerAddress: '0xcustomer',
      shopId: 'peanut',
      // no serviceId on the request, no serviceId on the conversation
      senderIdentifier: '0xcustomer',
      senderType: 'customer',
      messageText: 'Hi',
    });

    await waitForMicrotasks();

    expect(mockHandleCustomerMessage).not.toHaveBeenCalled();
  });

  it('skips on duplicate retry (created=false)', async () => {
    mockGetOrCreateConversation.mockResolvedValue(freshMockConversation());
    mockCreateMessage.mockResolvedValue({
      message: freshMockMessage(),
      created: false, // duplicate retry
    });

    const svc = new MessageService();
    svc.setWebSocketManager(makeWsManager());

    await svc.sendMessage({
      customerAddress: '0xcustomer',
      shopId: 'peanut',
      serviceId: 'srv_test',
      senderIdentifier: '0xcustomer',
      senderType: 'customer',
      messageText: 'Hi',
      clientMessageId: 'idempotent-key-1',
    });

    await waitForMicrotasks();

    expect(mockHandleCustomerMessage).not.toHaveBeenCalled();
  });
});

describe('AI auto-reply hook — does NOT block message-send', () => {
  it('returns the customer message immediately even if orchestrator is slow', async () => {
    mockGetOrCreateConversation.mockResolvedValue(freshMockConversation());
    mockCreateMessage.mockResolvedValue({
      message: freshMockMessage(),
      created: true,
    });

    // Slow orchestrator — 2 seconds
    let orchestratorResolve: (() => void) | null = null;
    mockHandleCustomerMessage.mockImplementation(
      () =>
        new Promise((resolve) => {
          orchestratorResolve = () =>
            resolve({
              outcome: 'ai_replied',
              aiMessageId: 'msg_ai',
              costUsd: 0.001,
              latencyMs: 2000,
              model: 'claude-sonnet-4-6',
            });
        })
    );

    const svc = new MessageService();
    svc.setWebSocketManager(makeWsManager());

    const start = Date.now();
    const result = await svc.sendMessage({
      customerAddress: '0xcustomer',
      shopId: 'peanut',
      serviceId: 'srv_test',
      senderIdentifier: '0xcustomer',
      senderType: 'customer',
      messageText: 'Hi',
    });
    const elapsed = Date.now() - start;

    // sendMessage should return without waiting for the orchestrator.
    expect(result.messageId).toBe('msg_123');
    expect(elapsed).toBeLessThan(500);

    // Orchestrator was scheduled but not yet awaited.
    await waitForMicrotasks();
    expect(mockHandleCustomerMessage).toHaveBeenCalled();

    // Resolve the orchestrator so jest doesn't leak the promise.
    if (orchestratorResolve) (orchestratorResolve as () => void)();
  });

  it('does not throw when orchestrator rejects', async () => {
    mockGetOrCreateConversation.mockResolvedValue(freshMockConversation());
    mockCreateMessage.mockResolvedValue({
      message: freshMockMessage(),
      created: true,
    });
    mockHandleCustomerMessage.mockRejectedValue(new Error('Anthropic 500'));

    const svc = new MessageService();
    svc.setWebSocketManager(makeWsManager());

    // sendMessage must succeed; the hook's failure is logged + swallowed.
    const result = await svc.sendMessage({
      customerAddress: '0xcustomer',
      shopId: 'peanut',
      serviceId: 'srv_test',
      senderIdentifier: '0xcustomer',
      senderType: 'customer',
      messageText: 'Hi',
    });

    await waitForMicrotasks();

    expect(result.messageId).toBe('msg_123');
    expect(mockHandleCustomerMessage).toHaveBeenCalledTimes(1);
  });
});

describe('AI auto-reply hook — outcome-driven WS broadcast', () => {
  it('does NOT broadcast WS when orchestrator returns skipped', async () => {
    mockGetOrCreateConversation.mockResolvedValue(freshMockConversation());
    mockCreateMessage.mockResolvedValue({
      message: freshMockMessage(),
      created: true,
    });
    mockHandleCustomerMessage.mockResolvedValue({
      outcome: 'skipped',
      reason: 'spend_cap_exceeded',
    });

    const ws = makeWsManager();
    const svc = new MessageService();
    svc.setWebSocketManager(ws);

    await svc.sendMessage({
      customerAddress: '0xcustomer',
      shopId: 'peanut',
      serviceId: 'srv_test',
      senderIdentifier: '0xcustomer',
      senderType: 'customer',
      messageText: 'Hi',
    });

    await waitForMicrotasks();

    // The customer-message-to-shop WS event still fires (that's the original
    // sendMessage broadcast). But there should be no broadcast targeting the
    // customer for an AI reply.
    const aiBroadcast = ws.sendToAddresses.mock.calls.find(
      (call: any[]) =>
        Array.isArray(call[0]) && call[0].includes('0xcustomer')
    );
    expect(aiBroadcast).toBeUndefined();
  });

  it('does NOT broadcast WS when orchestrator returns escalated', async () => {
    mockGetOrCreateConversation.mockResolvedValue(freshMockConversation());
    mockCreateMessage.mockResolvedValue({
      message: freshMockMessage(),
      created: true,
    });
    mockHandleCustomerMessage.mockResolvedValue({
      outcome: 'escalated',
      reason: 'customer_requested_human',
    });

    const ws = makeWsManager();
    const svc = new MessageService();
    svc.setWebSocketManager(ws);

    await svc.sendMessage({
      customerAddress: '0xcustomer',
      shopId: 'peanut',
      serviceId: 'srv_test',
      senderIdentifier: '0xcustomer',
      senderType: 'customer',
      messageText: 'I need a human',
    });

    await waitForMicrotasks();

    const aiBroadcast = ws.sendToAddresses.mock.calls.find(
      (call: any[]) =>
        Array.isArray(call[0]) && call[0].includes('0xcustomer')
    );
    expect(aiBroadcast).toBeUndefined();
  });

  it('does NOT broadcast WS when orchestrator returns failed', async () => {
    mockGetOrCreateConversation.mockResolvedValue(freshMockConversation());
    mockCreateMessage.mockResolvedValue({
      message: freshMockMessage(),
      created: true,
    });
    mockHandleCustomerMessage.mockResolvedValue({
      outcome: 'failed',
      error: 'anthropic 500',
    });

    const ws = makeWsManager();
    const svc = new MessageService();
    svc.setWebSocketManager(ws);

    await svc.sendMessage({
      customerAddress: '0xcustomer',
      shopId: 'peanut',
      serviceId: 'srv_test',
      senderIdentifier: '0xcustomer',
      senderType: 'customer',
      messageText: 'Hi',
    });

    await waitForMicrotasks();

    const aiBroadcast = ws.sendToAddresses.mock.calls.find(
      (call: any[]) =>
        Array.isArray(call[0]) && call[0].includes('0xcustomer')
    );
    expect(aiBroadcast).toBeUndefined();
  });
});
