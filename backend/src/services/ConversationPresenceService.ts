import { logger } from '../utils/logger';

/**
 * Tracks which wallet addresses are actively viewing which conversations.
 * Populated by WebSocketManager handling conversation:open/close frames.
 * Cleared on WS disconnect.
 *
 * Used by MessageService to suppress email notifications when the recipient
 * is already looking at the thread.
 *
 * In-memory only — fine for single-node backend. Migrate to Redis when we
 * horizontally scale.
 */
export class ConversationPresenceService {
  private viewing: Map<string, Set<string>> = new Map();

  markOpen(address: string, conversationId: string): void {
    const key = address.toLowerCase();
    let set = this.viewing.get(key);
    if (!set) {
      set = new Set();
      this.viewing.set(key, set);
    }
    set.add(conversationId);
    logger.debug('Presence: open', { address: key, conversationId });
  }

  markClosed(address: string, conversationId: string): void {
    const key = address.toLowerCase();
    const set = this.viewing.get(key);
    if (!set) return;
    set.delete(conversationId);
    if (set.size === 0) {
      this.viewing.delete(key);
    }
    logger.debug('Presence: close', { address: key, conversationId });
  }

  isViewing(address: string, conversationId: string): boolean {
    const set = this.viewing.get(address.toLowerCase());
    return !!set && set.has(conversationId);
  }

  clearAddress(address: string): void {
    this.viewing.delete(address.toLowerCase());
  }
}

export const conversationPresenceService = new ConversationPresenceService();
