// backend/src/repositories/ServiceAIFaqRepository.ts
//
// Repository for the service_ai_faq_entries table — Q&A pairs the shop
// owner authors per service for the AI agent to reference. Companion to
// shop_services.description: description is always rendered to Claude;
// FAQ entries are additive, surfaced as a structured "Frequently asked
// questions" block when non-empty.
//
// Strategy doc: docs/tasks/strategy/ai-sales-agent/ai-knowledge-base-strategy.md
// Migration:    113_drop_ai_custom_instructions_and_add_faq_table.sql

import { BaseRepository } from "./BaseRepository";
import { logger } from "../utils/logger";

export interface FaqEntry {
  faqEntryId: string;
  serviceId: string;
  question: string;
  answer: string;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Input shape for replaceEntriesForService. The shop dashboard posts the
 * full intended list every time the service form saves; this repo wipes
 * existing rows and reinserts in display_order = 0..N. Simplest model for
 * v1. Per-entry updates can come later if/when concurrency matters.
 */
export interface FaqEntryInput {
  question: string;
  answer: string;
}

export class ServiceAIFaqRepository extends BaseRepository {
  /**
   * Fetch all FAQ entries for a service, ordered by display_order (then
   * created_at as a tiebreaker — matches the index ordering).
   *
   * Returns an empty array when the service has no entries; never null.
   */
  async getEntriesForService(serviceId: string): Promise<FaqEntry[]> {
    try {
      const result = await this.pool.query(
        `SELECT faq_entry_id, service_id, question, answer, display_order, created_at, updated_at
           FROM service_ai_faq_entries
          WHERE service_id = $1
          ORDER BY display_order ASC, created_at ASC`,
        [serviceId]
      );
      return result.rows.map(this.mapRow);
    } catch (err) {
      logger.error("ServiceAIFaqRepository: getEntriesForService failed", {
        serviceId,
        error: (err as Error)?.message,
      });
      return [];
    }
  }

  /**
   * Replace ALL FAQ entries for a service with the given list, atomically.
   * Existing entries are deleted; the new entries are inserted in array
   * order (display_order = index). Empty input wipes all entries for the
   * service.
   *
   * Caller responsibilities:
   *   - Trim / sanitize question + answer text before passing in
   *     (ServiceManagementService does this).
   *   - Drop entries with empty answer text (form save discards them so
   *     starter-Q placeholders don't persist as half-filled rows).
   *
   * Returns the newly-inserted entries (with assigned IDs + timestamps).
   */
  async replaceEntriesForService(
    serviceId: string,
    entries: FaqEntryInput[]
  ): Promise<FaqEntry[]> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `DELETE FROM service_ai_faq_entries WHERE service_id = $1`,
        [serviceId]
      );
      const inserted: FaqEntry[] = [];
      for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        const res = await client.query(
          `INSERT INTO service_ai_faq_entries
             (service_id, question, answer, display_order)
           VALUES ($1, $2, $3, $4)
           RETURNING faq_entry_id, service_id, question, answer, display_order, created_at, updated_at`,
          [serviceId, e.question, e.answer, i]
        );
        inserted.push(this.mapRow(res.rows[0]));
      }
      await client.query("COMMIT");
      return inserted;
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      logger.error("ServiceAIFaqRepository: replaceEntriesForService failed", {
        serviceId,
        entryCount: entries.length,
        error: (err as Error)?.message,
      });
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Hard delete all FAQ entries for a service. Used when the service
   * itself is being deleted (though the table's ON DELETE CASCADE handles
   * that automatically too — this is for explicit "clear the FAQ" flows
   * that might come later from the dashboard).
   */
  async deleteEntriesForService(serviceId: string): Promise<number> {
    try {
      const result = await this.pool.query(
        `DELETE FROM service_ai_faq_entries WHERE service_id = $1`,
        [serviceId]
      );
      return result.rowCount ?? 0;
    } catch (err) {
      logger.error("ServiceAIFaqRepository: deleteEntriesForService failed", {
        serviceId,
        error: (err as Error)?.message,
      });
      throw err;
    }
  }

  private mapRow(row: any): FaqEntry {
    return {
      faqEntryId: row.faq_entry_id,
      serviceId: row.service_id,
      question: row.question,
      answer: row.answer,
      displayOrder: row.display_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
