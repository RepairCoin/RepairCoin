// backend/src/repositories/ConversationChannelIdentityRepository.ts
import { BaseRepository } from './BaseRepository';
import { logger } from '../utils/logger';
import { ConversationChannel } from './MessageRepository';

/**
 * Maps an external channel identity (phone in E.164 for SMS, WhatsApp id for
 * WhatsApp) to a conversation. This is the D1(b) foundation from the
 * AI Auto-Replies multi-channel scope
 * (docs/tasks/strategy/pricing-alignment/auto-replies-channel-expansion-scope.md):
 * an inbound SMS/WhatsApp carries only a phone/whatsapp id (no wallet), so we
 * need a phone → conversation lookup that the in-app `conversations` table
 * (keyed by wallet) can't provide.
 *
 * Backed by table `conversation_channel_identities` (migration 217). Phase 0
 * ships the store + accessors; the inbound router that populates and reads it
 * lands in Phase 1 (SMS) / Phase 2 (WhatsApp).
 */
export interface ConversationChannelIdentity {
  id: string;
  conversationId: string;
  channel: ConversationChannel;
  externalId: string;
  createdAt: Date;
  updatedAt: Date;
}

// Only off-app channels carry an external identity. 'app' conversations are
// keyed by wallet in `conversations` and never appear in this table.
export type ExternalChannel = Exclude<ConversationChannel, 'app'>;

export class ConversationChannelIdentityRepository extends BaseRepository {
  /**
   * Resolve an inbound (channel, externalId) to its conversation id, or null
   * if this identity has never been seen. Deterministic — the (channel,
   * external_id) unique constraint guarantees at most one row.
   */
  async findConversationId(channel: ExternalChannel, externalId: string): Promise<string | null> {
    try {
      const result = await this.pool.query(
        `SELECT conversation_id FROM conversation_channel_identities
         WHERE channel = $1 AND external_id = $2
         LIMIT 1`,
        [channel, externalId]
      );
      return result.rows.length > 0 ? result.rows[0].conversation_id : null;
    } catch (error) {
      logger.error('Error in findConversationId:', error);
      throw error;
    }
  }

  /**
   * Link an external identity to a conversation. Idempotent: re-linking the
   * same (channel, externalId) leaves it pointing at the same conversation and
   * just bumps updated_at. Returns the resolved identity row.
   */
  async link(
    conversationId: string,
    channel: ExternalChannel,
    externalId: string
  ): Promise<ConversationChannelIdentity> {
    try {
      const result = await this.pool.query(
        `INSERT INTO conversation_channel_identities (conversation_id, channel, external_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (channel, external_id)
           DO UPDATE SET updated_at = now()
         RETURNING *`,
        [conversationId, channel, externalId]
      );
      return this.mapRow(result.rows[0]);
    } catch (error) {
      logger.error('Error in link:', error);
      throw error;
    }
  }

  /**
   * All external identities attached to a conversation (e.g. to know which
   * phone to send an outbound reply to). Ordered newest-first.
   */
  async listForConversation(conversationId: string): Promise<ConversationChannelIdentity[]> {
    try {
      const result = await this.pool.query(
        `SELECT * FROM conversation_channel_identities
         WHERE conversation_id = $1
         ORDER BY updated_at DESC`,
        [conversationId]
      );
      return result.rows.map(row => this.mapRow(row));
    } catch (error) {
      logger.error('Error in listForConversation:', error);
      throw error;
    }
  }

  private mapRow(row: any): ConversationChannelIdentity {
    return {
      id: row.id,
      conversationId: row.conversation_id,
      channel: row.channel as ConversationChannel,
      externalId: row.external_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
