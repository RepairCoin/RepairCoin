import { BaseRepository } from './BaseRepository';
import { logger } from '../utils/logger';

export interface CommitmentEnrollment {
  id?: number;
  shopId: string;
  status: 'pending' | 'active' | 'completed' | 'cancelled' | 'defaulted';
  monthlyAmount: number;
  termMonths: number;
  totalCommitment: number;
  billingMethod?: 'credit_card' | 'ach' | 'wire';
  billingReference?: string;
  paymentsMade: number;
  totalPaid: number;
  nextPaymentDate?: Date;
  lastPaymentDate?: Date;
  enrolledAt: Date;
  activatedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
  notes?: string;
  createdBy?: string;
}

export class CommitmentRepository extends BaseRepository {
  
  async createEnrollment(enrollment: Omit<CommitmentEnrollment, 'id' | 'enrolledAt'>): Promise<CommitmentEnrollment> {
    try {
      const query = `
        INSERT INTO commitment_enrollments (
          shop_id, status, monthly_amount, term_months, total_commitment,
          billing_method, billing_reference, payments_made, total_paid,
          next_payment_date, created_by, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `;
      
      const result = await this.pool.query(query, [
        enrollment.shopId,
        enrollment.status || 'pending',
        enrollment.monthlyAmount,
        enrollment.termMonths,
        enrollment.totalCommitment,
        enrollment.billingMethod,
        enrollment.billingReference,
        enrollment.paymentsMade || 0,
        enrollment.totalPaid || 0,
        enrollment.nextPaymentDate,
        enrollment.createdBy,
        enrollment.notes
      ]);
      
      return this.mapSnakeToCamel(result.rows[0]);
    } catch (error) {
      logger.error('Error creating commitment enrollment:', error);
      throw error;
    }
  }

  async getActiveEnrollmentByShopId(shopId: string): Promise<CommitmentEnrollment | null> {
    try {
      const query = `
        SELECT * FROM commitment_enrollments 
        WHERE shop_id = $1 AND status = 'active'
        LIMIT 1
      `;
      
      const result = await this.pool.query(query, [shopId]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return this.mapSnakeToCamel(result.rows[0]);
    } catch (error) {
      logger.error('Error getting active commitment:', error);
      throw error;
    }
  }

  async getEnrollmentById(id: number): Promise<CommitmentEnrollment | null> {
    try {
      const query = 'SELECT * FROM commitment_enrollments WHERE id = $1';
      const result = await this.pool.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return this.mapSnakeToCamel(result.rows[0]);
    } catch (error) {
      logger.error('Error getting commitment by id:', error);
      throw error;
    }
  }

  async updateEnrollmentStatus(
    id: number, 
    status: 'active' | 'completed' | 'cancelled' | 'defaulted',
    additionalData?: {
      activatedAt?: Date;
      completedAt?: Date;
      cancelledAt?: Date;
      cancellationReason?: string;
    }
  ): Promise<CommitmentEnrollment> {
    try {
      let query = 'UPDATE commitment_enrollments SET status = $1';
      const params: any[] = [status];
      let paramIndex = 2;
      
      if (additionalData) {
        if (additionalData.activatedAt) {
          query += `, activated_at = $${paramIndex}`;
          params.push(additionalData.activatedAt);
          paramIndex++;
        }
        if (additionalData.completedAt) {
          query += `, completed_at = $${paramIndex}`;
          params.push(additionalData.completedAt);
          paramIndex++;
        }
        if (additionalData.cancelledAt) {
          query += `, cancelled_at = $${paramIndex}`;
          params.push(additionalData.cancelledAt);
          paramIndex++;
        }
        if (additionalData.cancellationReason) {
          query += `, cancellation_reason = $${paramIndex}`;
          params.push(additionalData.cancellationReason);
          paramIndex++;
        }
      }
      
      query += ` WHERE id = $${paramIndex} RETURNING *`;
      params.push(id);
      
      const result = await this.pool.query(query, params);
      
      if (result.rows.length === 0) {
        throw new Error('Commitment enrollment not found');
      }
      
      return this.mapSnakeToCamel(result.rows[0]);
    } catch (error) {
      logger.error('Error updating commitment status:', error);
      throw error;
    }
  }

  async recordPayment(enrollmentId: number, amount: number, paymentDate: Date = new Date()): Promise<void> {
    try {
      const query = `
        UPDATE commitment_enrollments 
        SET payments_made = payments_made + 1,
            total_paid = total_paid + $1,
            last_payment_date = $2,
            next_payment_date = $2 + INTERVAL '1 month'
        WHERE id = $3
      `;
      
      await this.pool.query(query, [amount, paymentDate, enrollmentId]);
      
      // Check if all payments are made
      const enrollment = await this.getEnrollmentById(enrollmentId);
      if (enrollment && enrollment.paymentsMade >= enrollment.termMonths) {
        await this.updateEnrollmentStatus(enrollmentId, 'completed', {
          completedAt: new Date()
        });
      }
    } catch (error) {
      logger.error('Error recording commitment payment:', error);
      throw error;
    }
  }

  async getPendingEnrollments(): Promise<CommitmentEnrollment[]> {
    try {
      const query = `
        SELECT * FROM commitment_enrollments 
        WHERE status = 'pending'
        ORDER BY enrolled_at DESC
      `;
      
      const result = await this.pool.query(query);
      return result.rows.map(row => this.mapSnakeToCamel(row));
    } catch (error) {
      logger.error('Error getting pending enrollments:', error);
      throw error;
    }
  }

  async getActiveEnrollments(): Promise<CommitmentEnrollment[]> {
    try {
      const query = `
        SELECT * FROM commitment_enrollments 
        WHERE status = 'active'
        ORDER BY next_payment_date ASC
      `;
      
      const result = await this.pool.query(query);
      return result.rows.map(row => this.mapSnakeToCamel(row));
    } catch (error) {
      logger.error('Error getting active enrollments:', error);
      throw error;
    }
  }

  async getOverduePayments(): Promise<CommitmentEnrollment[]> {
    try {
      const query = `
        SELECT * FROM commitment_enrollments 
        WHERE status = 'active' 
        AND next_payment_date < CURRENT_DATE
        ORDER BY next_payment_date ASC
      `;
      
      const result = await this.pool.query(query);
      return result.rows.map(row => this.mapSnakeToCamel(row));
    } catch (error) {
      logger.error('Error getting overdue payments:', error);
      throw error;
    }
  }

  // NEW: Check if shop can renew commitment
  async canShopRenewCommitment(shopId: string): Promise<boolean> {
    try {
      const query = `
        SELECT * FROM commitment_enrollments 
        WHERE shop_id = $1 
        AND status IN ('completed', 'active')
        ORDER BY enrolled_at DESC
        LIMIT 1
      `;
      
      const result = await this.pool.query(query, [shopId]);
      
      if (result.rows.length === 0) {
        return true; // No previous enrollment, can enroll
      }
      
      const enrollment = this.mapSnakeToCamel(result.rows[0]);
      
      // If currently active, cannot create new enrollment
      if (enrollment.status === 'active') {
        return false;
      }
      
      // If completed, can renew
      return enrollment.status === 'completed';
    } catch (error) {
      logger.error('Error checking renewal eligibility:', error);
      throw error;
    }
  }

  // NEW: Get all enrollments for a shop
  async getShopEnrollmentHistory(shopId: string): Promise<CommitmentEnrollment[]> {
    try {
      const query = `
        SELECT * FROM commitment_enrollments 
        WHERE shop_id = $1
        ORDER BY enrolled_at DESC
      `;
      
      const result = await this.pool.query(query, [shopId]);
      return result.rows.map(row => this.mapSnakeToCamel(row));
    } catch (error) {
      logger.error('Error getting shop enrollment history:', error);
      throw error;
    }
  }

  // NEW: Mark enrollment as defaulted after missed payments
  async markAsDefaulted(enrollmentId: number, missedPayments: number): Promise<CommitmentEnrollment> {
    try {
      return await this.updateEnrollmentStatus(enrollmentId, 'defaulted', {
        cancelledAt: new Date(),
        cancellationReason: `Defaulted after ${missedPayments} missed payments`
      });
    } catch (error) {
      logger.error('Error marking enrollment as defaulted:', error);
      throw error;
    }
  }

  // NEW: Check for shops with overdue payments (for cron job)
  async checkAndDefaultOverdueEnrollments(gracePeriodDays: number = 7): Promise<number> {
    try {
      const query = `
        UPDATE commitment_enrollments 
        SET status = 'defaulted',
            cancelled_at = NOW(),
            cancellation_reason = 'Auto-defaulted due to overdue payments'
        WHERE status = 'active'
        AND next_payment_date < CURRENT_DATE - INTERVAL '${gracePeriodDays} days'
        RETURNING id
      `;
      
      const result = await this.pool.query(query);
      
      // Update shop operational status for defaulted enrollments
      if (result.rows.length > 0) {
        const defaultedIds = result.rows.map(r => r.id);
        await this.updateShopOperationalStatusForDefaulted(defaultedIds);
      }
      
      return result.rows.length;
    } catch (error) {
      logger.error('Error checking overdue enrollments:', error);
      throw error;
    }
  }

  // Helper to update shop operational status
  private async updateShopOperationalStatusForDefaulted(enrollmentIds: number[]): Promise<void> {
    const query = `
      UPDATE shops 
      SET commitment_enrolled = false,
          operational_status = CASE 
            WHEN rcg_balance >= 10000 THEN 'rcg_qualified'
            ELSE 'not_qualified'
          END
      WHERE shop_id IN (
        SELECT shop_id FROM commitment_enrollments WHERE id = ANY($1)
      )
    `;
    
    await this.pool.query(query, [enrollmentIds]);
  }

  protected mapSnakeToCamel(row: any): CommitmentEnrollment {
    return {
      id: row.id,
      shopId: row.shop_id,
      status: row.status,
      monthlyAmount: parseFloat(row.monthly_amount),
      termMonths: row.term_months,
      totalCommitment: parseFloat(row.total_commitment),
      billingMethod: row.billing_method,
      billingReference: row.billing_reference,
      paymentsMade: row.payments_made,
      totalPaid: parseFloat(row.total_paid),
      nextPaymentDate: row.next_payment_date,
      lastPaymentDate: row.last_payment_date,
      enrolledAt: row.enrolled_at,
      activatedAt: row.activated_at,
      completedAt: row.completed_at,
      cancelledAt: row.cancelled_at,
      cancellationReason: row.cancellation_reason,
      notes: row.notes,
      createdBy: row.created_by
    };
  }
}