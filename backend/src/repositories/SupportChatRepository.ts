import { Pool } from 'pg';
import { getSharedPool } from '../utils/database-pool';

export interface SupportTicket {
  id: string;
  shopId: string;
  subject: string;
  status: 'open' | 'in_progress' | 'waiting_shop' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category?: 'billing' | 'technical' | 'account' | 'general' | 'feature_request';
  assignedTo?: string;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  closedAt?: Date;
  lastMessageAt: Date;
  unreadCount?: number;
  lastMessage?: string;
  shopName?: string;
}

export interface SupportMessage {
  id: string;
  ticketId: string;
  senderType: 'shop' | 'admin' | 'system';
  senderId: string;
  senderName?: string;
  message: string;
  attachments?: string[];
  isInternal: boolean;
  createdAt: Date;
  readAt?: Date;
  editedAt?: Date;
}

export interface CreateTicketParams {
  shopId: string;
  subject: string;
  message: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  category?: string;
}

export interface CreateMessageParams {
  ticketId: string;
  senderType: 'shop' | 'admin' | 'system';
  senderId: string;
  senderName?: string;
  message: string;
  attachments?: string[];
  isInternal?: boolean;
}

export class SupportChatRepository {
  private pool: Pool;

  constructor() {
    this.pool = getSharedPool();
  }

  /**
   * Create a new support ticket
   */
  async createTicket(params: CreateTicketParams): Promise<{ ticket: SupportTicket; message: SupportMessage }> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Create ticket
      const ticketQuery = `
        INSERT INTO support_tickets (shop_id, subject, priority, category)
        VALUES ($1, $2, $3, $4)
        RETURNING
          id,
          shop_id as "shopId",
          subject,
          status,
          priority,
          category,
          assigned_to as "assignedTo",
          created_at as "createdAt",
          updated_at as "updatedAt",
          resolved_at as "resolvedAt",
          closed_at as "closedAt",
          last_message_at as "lastMessageAt"
      `;

      const ticketResult = await client.query(ticketQuery, [
        params.shopId,
        params.subject,
        params.priority || 'medium',
        params.category
      ]);

      const ticket = ticketResult.rows[0];

      // Create first message
      const messageQuery = `
        INSERT INTO support_messages (ticket_id, sender_type, sender_id, message)
        VALUES ($1, 'shop', $2, $3)
        RETURNING
          id,
          ticket_id as "ticketId",
          sender_type as "senderType",
          sender_id as "senderId",
          sender_name as "senderName",
          message,
          attachments,
          is_internal as "isInternal",
          created_at as "createdAt",
          read_at as "readAt",
          edited_at as "editedAt"
      `;

      const messageResult = await client.query(messageQuery, [
        ticket.id,
        params.shopId,
        params.message
      ]);

      await client.query('COMMIT');

      return {
        ticket,
        message: messageResult.rows[0]
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get all tickets for a shop
   */
  async getShopTickets(shopId: string, status?: string): Promise<SupportTicket[]> {
    let query = `
      SELECT
        t.id,
        t.shop_id as "shopId",
        t.subject,
        t.status,
        t.priority,
        t.category,
        t.assigned_to as "assignedTo",
        t.created_at as "createdAt",
        t.updated_at as "updatedAt",
        t.resolved_at as "resolvedAt",
        t.closed_at as "closedAt",
        t.last_message_at as "lastMessageAt",
        (
          SELECT COUNT(*)
          FROM support_messages m
          WHERE m.ticket_id = t.id
            AND m.sender_type = 'admin'
            AND m.read_at IS NULL
        ) as "unreadCount",
        (
          SELECT m.message
          FROM support_messages m
          WHERE m.ticket_id = t.id
          ORDER BY m.created_at DESC
          LIMIT 1
        ) as "lastMessage"
      FROM support_tickets t
      WHERE t.shop_id = $1
    `;

    const params: any[] = [shopId];

    if (status) {
      query += ` AND t.status = $2`;
      params.push(status);
    }

    query += ` ORDER BY t.last_message_at DESC`;

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  /**
   * Get all tickets for admin view
   */
  async getAllTickets(filters?: {
    status?: string;
    priority?: string;
    assignedTo?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ tickets: SupportTicket[]; total: number }> {
    const { status, priority, assignedTo, limit = 50, offset = 0 } = filters || {};

    let whereConditions: string[] = [];
    let queryParams: any[] = [];
    let paramCount = 1;

    if (status) {
      whereConditions.push(`t.status = $${paramCount}`);
      queryParams.push(status);
      paramCount++;
    }

    if (priority) {
      whereConditions.push(`t.priority = $${paramCount}`);
      queryParams.push(priority);
      paramCount++;
    }

    if (assignedTo) {
      whereConditions.push(`t.assigned_to = $${paramCount}`);
      queryParams.push(assignedTo);
      paramCount++;
    }

    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM support_tickets t ${whereClause}`;
    const countResult = await this.pool.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].count);

    // Get tickets
    const query = `
      SELECT
        t.id,
        t.shop_id as "shopId",
        t.subject,
        t.status,
        t.priority,
        t.category,
        t.assigned_to as "assignedTo",
        t.created_at as "createdAt",
        t.updated_at as "updatedAt",
        t.resolved_at as "resolvedAt",
        t.closed_at as "closedAt",
        t.last_message_at as "lastMessageAt",
        s.name as "shopName",
        (
          SELECT COUNT(*)
          FROM support_messages m
          WHERE m.ticket_id = t.id
            AND m.sender_type = 'shop'
            AND m.read_at IS NULL
        ) as "unreadCount",
        (
          SELECT m.message
          FROM support_messages m
          WHERE m.ticket_id = t.id
            AND m.is_internal = false
          ORDER BY m.created_at DESC
          LIMIT 1
        ) as "lastMessage"
      FROM support_tickets t
      LEFT JOIN shops s ON t.shop_id = s.shop_id
      ${whereClause}
      ORDER BY t.last_message_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    queryParams.push(limit, offset);
    const result = await this.pool.query(query, queryParams);

    return {
      tickets: result.rows,
      total
    };
  }

  /**
   * Get ticket by ID
   */
  async getTicketById(ticketId: string): Promise<SupportTicket | null> {
    const query = `
      SELECT
        t.id,
        t.shop_id as "shopId",
        t.subject,
        t.status,
        t.priority,
        t.category,
        t.assigned_to as "assignedTo",
        t.created_at as "createdAt",
        t.updated_at as "updatedAt",
        t.resolved_at as "resolvedAt",
        t.closed_at as "closedAt",
        t.last_message_at as "lastMessageAt",
        s.name as "shopName"
      FROM support_tickets t
      LEFT JOIN shops s ON t.shop_id = s.shop_id
      WHERE t.id = $1
    `;

    const result = await this.pool.query(query, [ticketId]);
    return result.rows[0] || null;
  }

  /**
   * Get messages for a ticket
   */
  async getTicketMessages(ticketId: string, includeInternal: boolean = false): Promise<SupportMessage[]> {
    let query = `
      SELECT
        id,
        ticket_id as "ticketId",
        sender_type as "senderType",
        sender_id as "senderId",
        sender_name as "senderName",
        message,
        attachments,
        is_internal as "isInternal",
        created_at as "createdAt",
        read_at as "readAt",
        edited_at as "editedAt"
      FROM support_messages
      WHERE ticket_id = $1
    `;

    if (!includeInternal) {
      query += ` AND is_internal = false`;
    }

    query += ` ORDER BY created_at ASC`;

    const result = await this.pool.query(query, [ticketId]);
    return result.rows;
  }

  /**
   * Create a message
   */
  async createMessage(params: CreateMessageParams): Promise<SupportMessage> {
    const query = `
      INSERT INTO support_messages (
        ticket_id, sender_type, sender_id, sender_name, message, attachments, is_internal
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING
        id,
        ticket_id as "ticketId",
        sender_type as "senderType",
        sender_id as "senderId",
        sender_name as "senderName",
        message,
        attachments,
        is_internal as "isInternal",
        created_at as "createdAt",
        read_at as "readAt",
        edited_at as "editedAt"
    `;

    const result = await this.pool.query(query, [
      params.ticketId,
      params.senderType,
      params.senderId,
      params.senderName,
      params.message,
      params.attachments ? JSON.stringify(params.attachments) : null,
      params.isInternal || false
    ]);

    return result.rows[0];
  }

  /**
   * Update ticket status
   */
  async updateTicketStatus(
    ticketId: string,
    status: string,
    assignedTo?: string
  ): Promise<SupportTicket> {
    const fields: string[] = ['status = $2'];
    const params: any[] = [ticketId, status];
    let paramCount = 3;

    if (assignedTo !== undefined) {
      fields.push(`assigned_to = $${paramCount}`);
      params.push(assignedTo);
      paramCount++;
    }

    if (status === 'resolved') {
      fields.push(`resolved_at = CURRENT_TIMESTAMP`);
    } else if (status === 'closed') {
      fields.push(`closed_at = CURRENT_TIMESTAMP`);
    }

    const query = `
      UPDATE support_tickets
      SET ${fields.join(', ')}
      WHERE id = $1
      RETURNING
        id,
        shop_id as "shopId",
        subject,
        status,
        priority,
        category,
        assigned_to as "assignedTo",
        created_at as "createdAt",
        updated_at as "updatedAt",
        resolved_at as "resolvedAt",
        closed_at as "closedAt",
        last_message_at as "lastMessageAt"
    `;

    const result = await this.pool.query(query, params);
    return result.rows[0];
  }

  /**
   * Mark messages as read
   */
  async markMessagesAsRead(ticketId: string, viewerType: 'shop' | 'admin'): Promise<void> {
    // Mark unread messages from the OTHER party as read
    const senderTypeToMark = viewerType === 'shop' ? 'admin' : 'shop';

    const query = `
      UPDATE support_messages
      SET read_at = CURRENT_TIMESTAMP
      WHERE ticket_id = $1
        AND sender_type = $2
        AND read_at IS NULL
    `;

    await this.pool.query(query, [ticketId, senderTypeToMark]);
  }

  /**
   * Get unread ticket count for shop
   */
  async getUnreadTicketCount(shopId: string): Promise<number> {
    const query = `
      SELECT COUNT(DISTINCT t.id)
      FROM support_tickets t
      JOIN support_messages m ON t.id = m.ticket_id
      WHERE t.shop_id = $1
        AND m.sender_type = 'admin'
        AND m.read_at IS NULL
        AND t.status NOT IN ('closed')
    `;

    const result = await this.pool.query(query, [shopId]);
    return parseInt(result.rows[0].count);
  }

  /**
   * Get admin statistics
   */
  async getAdminStats(): Promise<{
    total: number;
    open: number;
    inProgress: number;
    waitingShop: number;
    resolved: number;
    unassigned: number;
  }> {
    const query = `
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'open') as open,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
        COUNT(*) FILTER (WHERE status = 'waiting_shop') as waiting_shop,
        COUNT(*) FILTER (WHERE status = 'resolved') as resolved,
        COUNT(*) FILTER (WHERE assigned_to IS NULL AND status NOT IN ('closed', 'resolved')) as unassigned
      FROM support_tickets
      WHERE status != 'closed'
    `;

    const result = await this.pool.query(query);
    const row = result.rows[0];

    return {
      total: parseInt(row.total),
      open: parseInt(row.open),
      inProgress: parseInt(row.in_progress),
      waitingShop: parseInt(row.waiting_shop),
      resolved: parseInt(row.resolved),
      unassigned: parseInt(row.unassigned)
    };
  }
}

export default new SupportChatRepository();
