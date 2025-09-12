import { commitmentRepository, shopRepository } from '../repositories';
import { logger } from '../utils/logger';
import { eventBus } from '../events/EventBus';

export class CommitmentPaymentService {
  private static instance: CommitmentPaymentService;
  
  static getInstance(): CommitmentPaymentService {
    if (!CommitmentPaymentService.instance) {
      CommitmentPaymentService.instance = new CommitmentPaymentService();
    }
    return CommitmentPaymentService.instance;
  }
  
  /**
   * Process payment for commitment enrollment
   * This would integrate with payment processors (Stripe, PayPal, etc.)
   */
  async processMonthlyPayment(enrollmentId: number): Promise<boolean> {
    try {
      const enrollment = await commitmentRepository.getEnrollmentById(enrollmentId);
      if (!enrollment) {
        throw new Error('Enrollment not found');
      }
      
      if (enrollment.status !== 'active') {
        logger.warn(`Attempted to process payment for non-active enrollment ${enrollmentId}`);
        return false;
      }
      
      // TODO: Integrate with payment processor
      // For now, this is a placeholder showing the flow
      const paymentSuccessful = await this.chargePaymentMethod(
        enrollment.billingMethod,
        enrollment.billingReference,
        enrollment.monthlyAmount
      );
      
      if (paymentSuccessful) {
        // Record successful payment
        await commitmentRepository.recordPayment(
          enrollmentId,
          enrollment.monthlyAmount
        );
        
        // Emit event for successful payment
        await eventBus.publish({
          type: 'commitment.payment_processed',
          aggregateId: enrollment.shopId,
          data: {
            enrollmentId,
            shopId: enrollment.shopId,
            amount: enrollment.monthlyAmount,
            paymentsMade: enrollment.paymentsMade + 1,
            totalPaid: enrollment.totalPaid + enrollment.monthlyAmount
          },
          source: 'CommitmentPaymentService',
          timestamp: new Date(),
          version: 1
        });
        
        logger.info(`Payment processed for enrollment ${enrollmentId}`, {
          shopId: enrollment.shopId,
          amount: enrollment.monthlyAmount
        });
        
        return true;
      } else {
        // Handle failed payment
        await this.handleFailedPayment(enrollment);
        return false;
      }
    } catch (error) {
      logger.error('Error processing commitment payment:', error);
      return false;
    }
  }
  
  /**
   * Charge payment method (placeholder - implement with real payment processor)
   */
  private async chargePaymentMethod(
    method?: string,
    reference?: string,
    amount?: number
  ): Promise<boolean> {
    // TODO: Implement actual payment processing
    // This would integrate with:
    // - Stripe for credit cards
    // - Plaid for ACH
    // - Bank APIs for wire transfers
    
    logger.info('Payment processing placeholder', { method, reference, amount });
    
    // For now, simulate payment success/failure
    // In production, this would make actual API calls
    return true;
  }
  
  /**
   * Handle failed payment attempts
   */
  private async handleFailedPayment(enrollment: any): Promise<void> {
    // Check how many days overdue
    const daysSincePaymentDue = Math.floor(
      (Date.now() - new Date(enrollment.nextPaymentDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    
    // Send notifications based on how overdue
    if (daysSincePaymentDue === 1) {
      await this.sendPaymentFailureNotification(enrollment, 'first_warning');
    } else if (daysSincePaymentDue === 3) {
      await this.sendPaymentFailureNotification(enrollment, 'second_warning');
    } else if (daysSincePaymentDue === 7) {
      await this.sendPaymentFailureNotification(enrollment, 'final_warning');
    } else if (daysSincePaymentDue > 7) {
      // Default the enrollment
      await commitmentRepository.markAsDefaulted(enrollment.id, 1);
      await this.sendPaymentFailureNotification(enrollment, 'defaulted');
      
      // Update shop operational status
      await shopRepository.updateShop(enrollment.shopId, {
        commitment_enrolled: false,
        operational_status: 'not_qualified' // Unless they have RCG
      });
    }
  }
  
  /**
   * Send payment failure notifications
   */
  private async sendPaymentFailureNotification(
    enrollment: any,
    type: 'first_warning' | 'second_warning' | 'final_warning' | 'defaulted'
  ): Promise<void> {
    // TODO: Implement email/SMS notifications
    await eventBus.publish({
      type: 'commitment.payment_warning',
      aggregateId: enrollment.shopId,
      data: {
        enrollmentId: enrollment.id,
        shopId: enrollment.shopId,
        warningType: type
      },
      source: 'CommitmentPaymentService',
      timestamp: new Date(),
      version: 1
    });
    
    logger.warn(`Payment warning sent: ${type}`, {
      enrollmentId: enrollment.id,
      shopId: enrollment.shopId
    });
  }
  
  /**
   * Daily cron job to process due payments
   */
  async processDuePayments(): Promise<void> {
    try {
      const activeEnrollments = await commitmentRepository.getActiveEnrollments();
      
      for (const enrollment of activeEnrollments) {
        if (!enrollment.nextPaymentDate) continue;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const paymentDate = new Date(enrollment.nextPaymentDate);
        paymentDate.setHours(0, 0, 0, 0);
        
        // Process payment if due today
        if (paymentDate.getTime() === today.getTime()) {
          await this.processMonthlyPayment(enrollment.id!);
        }
      }
    } catch (error) {
      logger.error('Error processing due payments:', error);
    }
  }
  
  /**
   * Daily cron job to check for overdue payments
   */
  async checkOverduePayments(): Promise<void> {
    try {
      const overdueEnrollments = await commitmentRepository.getOverduePayments();
      
      for (const enrollment of overdueEnrollments) {
        await this.handleFailedPayment(enrollment);
      }
      
      // Auto-default enrollments that are 7+ days overdue
      const defaultedCount = await commitmentRepository.checkAndDefaultOverdueEnrollments(7);
      
      if (defaultedCount > 0) {
        logger.warn(`Auto-defaulted ${defaultedCount} overdue enrollments`);
      }
    } catch (error) {
      logger.error('Error checking overdue payments:', error);
    }
  }
  
  /**
   * Get payment schedule for an enrollment
   */
  async getPaymentSchedule(enrollmentId: number): Promise<any[]> {
    const enrollment = await commitmentRepository.getEnrollmentById(enrollmentId);
    if (!enrollment) {
      throw new Error('Enrollment not found');
    }
    
    const schedule = [];
    let paymentDate = new Date(enrollment.activatedAt || enrollment.enrolledAt);
    
    for (let i = 0; i < enrollment.termMonths; i++) {
      const isPaid = i < enrollment.paymentsMade;
      const dueDate = new Date(paymentDate);
      dueDate.setMonth(dueDate.getMonth() + i);
      
      schedule.push({
        paymentNumber: i + 1,
        dueDate,
        amount: enrollment.monthlyAmount,
        status: isPaid ? 'paid' : dueDate < new Date() ? 'overdue' : 'pending',
        paidDate: isPaid && enrollment.lastPaymentDate ? enrollment.lastPaymentDate : null
      });
    }
    
    return schedule;
  }
}

export default CommitmentPaymentService;