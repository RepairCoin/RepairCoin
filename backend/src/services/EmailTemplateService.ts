import { DatabaseService } from './DatabaseService';
import { logger } from '../utils/logger';

export interface EmailTemplate {
  id: number;
  templateKey: string;
  templateName: string;
  category: 'welcome' | 'booking' | 'transaction' | 'shop' | 'support';
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  variables: string[];
  enabled: boolean;
  isDefault: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  modifiedBy?: string;
  lastSentAt?: Date;
}

export interface RenderedEmail {
  subject: string;
  bodyHtml: string;
  bodyText: string;
}

export class EmailTemplateService {
  private db: DatabaseService;

  constructor() {
    this.db = DatabaseService.getInstance();
  }

  /**
   * Get all email templates, optionally filtered by category
   */
  async getTemplates(category?: string): Promise<EmailTemplate[]> {
    try {
      let query = `
        SELECT
          id, template_key, template_name, category, subject,
          body_html, body_text, variables, enabled, is_default,
          version, created_at, updated_at, modified_by, last_sent_at
        FROM email_templates
      `;

      const params: any[] = [];
      if (category) {
        query += ' WHERE category = $1';
        params.push(category);
      }

      query += ' ORDER BY category, template_name';

      const result = await this.db.query(query, params);

      return result.rows.map(row => this.mapRowToTemplate(row));
    } catch (error) {
      logger.error('Error fetching email templates:', error);
      throw error;
    }
  }

  /**
   * Get a single email template by key
   */
  async getTemplate(templateKey: string): Promise<EmailTemplate | null> {
    try {
      const result = await this.db.query(
        `SELECT
          id, template_key, template_name, category, subject,
          body_html, body_text, variables, enabled, is_default,
          version, created_at, updated_at, modified_by, last_sent_at
        FROM email_templates
        WHERE template_key = $1`,
        [templateKey]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToTemplate(result.rows[0]);
    } catch (error) {
      logger.error(`Error fetching template ${templateKey}:`, error);
      throw error;
    }
  }

  /**
   * Update an email template
   */
  async updateTemplate(
    templateKey: string,
    updates: Partial<EmailTemplate>,
    modifiedBy: string
  ): Promise<EmailTemplate> {
    try {
      const allowedFields = ['subject', 'body_html', 'body_text'];
      const setClauses: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      // Build dynamic SET clause
      Object.entries(updates).forEach(([key, value]) => {
        const snakeKey = this.camelToSnake(key);
        if (allowedFields.includes(snakeKey)) {
          setClauses.push(`${snakeKey} = $${paramIndex}`);
          values.push(value);
          paramIndex++;
        }
      });

      if (setClauses.length === 0) {
        throw new Error('No valid fields to update');
      }

      // Add modified_by and version increment
      setClauses.push(`modified_by = $${paramIndex}`);
      values.push(modifiedBy);
      paramIndex++;

      setClauses.push(`version = version + 1`);
      setClauses.push(`is_default = false`); // Mark as custom when modified

      values.push(templateKey); // WHERE clause parameter

      const query = `
        UPDATE email_templates
        SET ${setClauses.join(', ')}
        WHERE template_key = $${paramIndex}
        RETURNING
          id, template_key, template_name, category, subject,
          body_html, body_text, variables, enabled, is_default,
          version, created_at, updated_at, modified_by, last_sent_at
      `;

      const result = await this.db.query(query, values);

      if (result.rows.length === 0) {
        throw new Error(`Template ${templateKey} not found`);
      }

      logger.info(`Template ${templateKey} updated by ${modifiedBy}`);

      return this.mapRowToTemplate(result.rows[0]);
    } catch (error) {
      logger.error(`Error updating template ${templateKey}:`, error);
      throw error;
    }
  }

  /**
   * Toggle template enabled status
   */
  async toggleTemplate(templateKey: string, enabled: boolean): Promise<void> {
    try {
      await this.db.query(
        'UPDATE email_templates SET enabled = $1 WHERE template_key = $2',
        [enabled, templateKey]
      );

      logger.info(`Template ${templateKey} ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      logger.error(`Error toggling template ${templateKey}:`, error);
      throw error;
    }
  }

  /**
   * Reset template to default (delete custom version, will fall back to migration default)
   */
  async resetToDefault(templateKey: string): Promise<void> {
    try {
      // Check if template is default
      const template = await this.getTemplate(templateKey);

      if (!template) {
        throw new Error(`Template ${templateKey} not found`);
      }

      if (template.isDefault) {
        throw new Error('Cannot reset a default template');
      }

      // For custom templates, we could either:
      // 1. Delete and let it fall back to default from migration
      // 2. Update it with default values
      // Here we'll update with original default values by re-running migration

      // This is a simplified approach - in production you might want to store
      // original defaults in a separate table
      throw new Error('Reset to default not fully implemented - requires default templates backup');

      // TODO: Implement proper default template restoration
      // Option 1: Store defaults in code and restore from there
      // Option 2: Keep a defaults backup table
      // Option 3: Mark for re-seeding on next migration
    } catch (error) {
      logger.error(`Error resetting template ${templateKey}:`, error);
      throw error;
    }
  }

  /**
   * Render email template with variables
   */
  async renderTemplate(
    templateKey: string,
    variables: Record<string, string>
  ): Promise<RenderedEmail> {
    try {
      const template = await this.getTemplate(templateKey);

      if (!template) {
        throw new Error(`Template ${templateKey} not found`);
      }

      if (!template.enabled) {
        throw new Error(`Template ${templateKey} is disabled`);
      }

      // Replace variables in subject
      let subject = template.subject;
      let bodyHtml = template.bodyHtml;
      let bodyText = template.bodyText || '';

      // Replace {{variable}} with actual values
      Object.entries(variables).forEach(([key, value]) => {
        const placeholder = `{{${key}}}`;
        subject = subject.replace(new RegExp(placeholder, 'g'), value);
        bodyHtml = bodyHtml.replace(new RegExp(placeholder, 'g'), value);
        bodyText = bodyText.replace(new RegExp(placeholder, 'g'), value);
      });

      return {
        subject,
        bodyHtml,
        bodyText: bodyText || this.stripHtml(bodyHtml),
      };
    } catch (error) {
      logger.error(`Error rendering template ${templateKey}:`, error);
      throw error;
    }
  }

  /**
   * Update last_sent_at timestamp when email is sent
   */
  async markAsSent(templateKey: string): Promise<void> {
    try {
      await this.db.query(
        'UPDATE email_templates SET last_sent_at = NOW() WHERE template_key = $1',
        [templateKey]
      );
    } catch (error) {
      logger.error(`Error marking template ${templateKey} as sent:`, error);
      // Don't throw - this is not critical
    }
  }

  /**
   * Helper: Map database row to EmailTemplate interface
   */
  private mapRowToTemplate(row: any): EmailTemplate {
    return {
      id: row.id,
      templateKey: row.template_key,
      templateName: row.template_name,
      category: row.category,
      subject: row.subject,
      bodyHtml: row.body_html,
      bodyText: row.body_text,
      variables: Array.isArray(row.variables) ? row.variables : [],
      enabled: row.enabled,
      isDefault: row.is_default,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      modifiedBy: row.modified_by,
      lastSentAt: row.last_sent_at,
    };
  }

  /**
   * Helper: Convert camelCase to snake_case
   */
  private camelToSnake(str: string): string {
    return str.replace(/([A-Z])/g, '_$1').toLowerCase();
  }

  /**
   * Helper: Strip HTML tags for plain text version
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<style[^>]*>.*<\/style>/gm, '')
      .replace(/<script[^>]*>.*<\/script>/gm, '')
      .replace(/<[^>]+>/gm, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
