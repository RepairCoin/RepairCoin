import * as messagingApi from './api/messaging';

/**
 * Background outbox for sending messages.
 *
 * - Optimistic: UI appends the message instantly and subscribes for updates.
 * - Retries with exponential backoff (1s → 2s → 5s → 15s, max 4 attempts).
 * - Per-conversation FIFO: next item dispatches only after the prior settles.
 * - Idempotent on the server via clientMessageId — retries never double-insert.
 * - Persisted to localStorage so a refresh mid-send doesn't drop the message.
 * - Subscribers receive status updates; the UI replaces optimistic with
 *   the canonical server message on success.
 */

export type OutboxStatus = 'sending' | 'sent' | 'failed';

export interface OutboxPayload {
  conversationId: string;
  messageText: string;
  messageType?: 'text' | 'booking_link' | 'service_link' | 'system';
  metadata?: Record<string, unknown>;
  attachments?: messagingApi.MessageAttachment[];
}

export interface OutboxItem {
  clientMessageId: string;
  payload: OutboxPayload;
  status: OutboxStatus;
  attempts: number;
  lastError?: string;
  createdAt: number;
}

export interface OutboxUpdate {
  clientMessageId: string;
  status: OutboxStatus;
  conversationId: string;
  attempts: number;
  message?: messagingApi.Message;
  error?: string;
}

type Listener = (update: OutboxUpdate) => void;

const STORAGE_KEY = 'message_outbox_v1';
const BACKOFF_MS = [1000, 2000, 5000, 15000];
const MAX_ATTEMPTS = BACKOFF_MS.length;

class MessageOutbox {
  private items: Map<string, OutboxItem> = new Map();
  private queueByConv: Map<string, string[]> = new Map();
  private dispatching: Set<string> = new Set();
  private listeners: Set<Listener> = new Set();
  private hydrated = false;

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getPending(conversationId: string): OutboxItem[] {
    const ids = this.queueByConv.get(conversationId) || [];
    return ids.map(id => this.items.get(id)!).filter(Boolean);
  }

  enqueue(payload: OutboxPayload): OutboxItem {
    this.hydrateOnce();
    const clientMessageId = generateId();
    const item: OutboxItem = {
      clientMessageId,
      payload,
      status: 'sending',
      attempts: 0,
      createdAt: Date.now(),
    };
    this.items.set(clientMessageId, item);

    const ids = this.queueByConv.get(payload.conversationId) || [];
    ids.push(clientMessageId);
    this.queueByConv.set(payload.conversationId, ids);

    this.persist();
    this.kick(payload.conversationId);
    return item;
  }

  retry(clientMessageId: string): void {
    const item = this.items.get(clientMessageId);
    if (!item || item.status === 'sent') return;
    item.status = 'sending';
    item.attempts = 0;
    item.lastError = undefined;

    const ids = this.queueByConv.get(item.payload.conversationId) || [];
    if (!ids.includes(clientMessageId)) {
      ids.unshift(clientMessageId);
      this.queueByConv.set(item.payload.conversationId, ids);
    }

    this.emit({
      clientMessageId,
      status: 'sending',
      conversationId: item.payload.conversationId,
      attempts: 0,
    });

    this.persist();
    this.kick(item.payload.conversationId);
  }

  discard(clientMessageId: string): void {
    const item = this.items.get(clientMessageId);
    if (!item) return;
    this.items.delete(clientMessageId);
    const ids = this.queueByConv.get(item.payload.conversationId) || [];
    this.queueByConv.set(
      item.payload.conversationId,
      ids.filter(id => id !== clientMessageId),
    );
    this.persist();
  }

  private async kick(conversationId: string): Promise<void> {
    if (this.dispatching.has(conversationId)) return;
    const next = this.peekNext(conversationId);
    if (!next) return;
    this.dispatching.add(conversationId);
    try {
      await this.dispatch(next);
    } finally {
      this.dispatching.delete(conversationId);
      if (this.peekNext(conversationId)) this.kick(conversationId);
    }
  }

  private peekNext(conversationId: string): OutboxItem | null {
    const ids = this.queueByConv.get(conversationId) || [];
    for (const id of ids) {
      const item = this.items.get(id);
      if (item && item.status === 'sending') return item;
    }
    return null;
  }

  private async dispatch(item: OutboxItem): Promise<void> {
    while (item.attempts < MAX_ATTEMPTS) {
      item.attempts += 1;
      try {
        const message = await messagingApi.sendMessage({
          conversationId: item.payload.conversationId,
          messageText: item.payload.messageText,
          messageType: item.payload.messageType,
          metadata: item.payload.metadata,
          attachments: item.payload.attachments,
          clientMessageId: item.clientMessageId,
        });

        item.status = 'sent';
        this.emit({
          clientMessageId: item.clientMessageId,
          status: 'sent',
          conversationId: item.payload.conversationId,
          attempts: item.attempts,
          message,
        });
        this.removeFromQueue(item);
        this.persist();
        return;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Send failed';
        item.lastError = message;
        if (item.attempts >= MAX_ATTEMPTS) {
          item.status = 'failed';
          this.emit({
            clientMessageId: item.clientMessageId,
            status: 'failed',
            conversationId: item.payload.conversationId,
            attempts: item.attempts,
            error: message,
          });
          this.persist();
          return;
        }
        await sleep(BACKOFF_MS[item.attempts - 1]);
      }
    }
  }

  private removeFromQueue(item: OutboxItem): void {
    const ids = this.queueByConv.get(item.payload.conversationId) || [];
    this.queueByConv.set(
      item.payload.conversationId,
      ids.filter(id => id !== item.clientMessageId),
    );
  }

  private emit(update: OutboxUpdate): void {
    this.listeners.forEach(listener => {
      try {
        listener(update);
      } catch {
        /* swallow listener errors */
      }
    });
  }

  private persist(): void {
    if (typeof window === 'undefined') return;
    const data = Array.from(this.items.values()).filter(item => item.status !== 'sent');
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* ignore quota errors */
    }
  }

  hydrateOnce(): void {
    if (this.hydrated || typeof window === 'undefined') return;
    this.hydrated = true;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as OutboxItem[];
      saved.forEach(item => {
        this.items.set(item.clientMessageId, item);
        const ids = this.queueByConv.get(item.payload.conversationId) || [];
        ids.push(item.clientMessageId);
        this.queueByConv.set(item.payload.conversationId, ids);
      });
      const resumable = new Set(saved.map(s => s.payload.conversationId));
      resumable.forEach(convId => {
        const next = this.peekNext(convId);
        if (next) this.kick(convId);
      });
    } catch {
      /* ignore parse errors — just start fresh */
    }
  }
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `cm_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const messageOutbox = new MessageOutbox();
