const fs = require('fs');
const path = 'C:/dev/RepairCoin/backend/src/services/AppointmentReminderService.ts';
let content = fs.readFileSync(path, 'utf8');

// Find and replace the processReminderType method
const oldMethodPattern = /\/\*\*\s*\n\s*\* Process reminders for a specific reminder type\s*\n\s*\*\/\s*\n\s*async processReminderType\(config: ReminderConfig\): Promise<\{\s*\n\s*sent: number;\s*\n\s*emailsSent: number;\s*\n\s*inAppSent: number;\s*\n\s*shopNotificationsSent: number;\s*\n\s*errors: string\[\];\s*\n\s*\}> \{[\s\S]*?return result;\s*\n\s*\}/;

const newMethod = `/**
   * Process reminders for a specific reminder type
   * Now respects customer notification preferences
   */
  async processReminderType(config: ReminderConfig): Promise<{
    sent: number;
    emailsSent: number;
    inAppSent: number;
    shopNotificationsSent: number;
    skippedByPreference: number;
    errors: string[];
  }> {
    const result = {
      sent: 0,
      emailsSent: 0,
      inAppSent: 0,
      shopNotificationsSent: 0,
      skippedByPreference: 0,
      errors: [] as string[]
    };

    try {
      const appointments = await this.getAppointmentsForReminderType(config);
      logger.info(\`Found \${appointments.length} appointments needing \${config.type} reminders\`);

      for (const appointment of appointments) {
        try {
          // Get customer notification preferences
          const prefs = await notificationPreferencesRepository.getByCustomerAddress(appointment.customerAddress);

          // Check if this reminder type is enabled by customer preference
          const reminderTypeEnabled =
            (config.type === '24h' && prefs.reminder24hEnabled) ||
            (config.type === '2h' && prefs.reminder2hEnabled);

          if (!reminderTypeEnabled) {
            logger.debug(\`Skipping \${config.type} reminder for \${appointment.orderId} - disabled by customer preference\`);
            result.skippedByPreference++;
            // Still mark as sent to avoid re-processing
            await this.markReminderTypeSent(appointment.orderId, config);
            result.sent++;
            continue;
          }

          // Send email if configured AND customer has email enabled
          if (config.sendEmail && prefs.emailEnabled) {
            const emailSent = await this.sendCustomerReminderEmail(appointment);
            if (emailSent) {
              result.emailsSent++;
            }
          }

          // Send in-app notification if configured AND customer has in-app enabled
          if (config.sendInApp && prefs.inAppEnabled) {
            if (config.type === '24h') {
              await this.sendCustomerInAppNotification(appointment);
            } else if (config.type === '2h') {
              await this.sendCustomer2HourInAppNotification(appointment);
            }
            result.inAppSent++;
          }

          // Send shop notification if configured (shops always get notified)
          if (config.sendShopNotification) {
            if (config.type === '24h') {
              await this.sendShopNotification(appointment);
            } else if (config.type === '2h') {
              await this.sendShop2HourNotification(appointment);
            }
            result.shopNotificationsSent++;
          }

          // Mark as sent
          await this.markReminderTypeSent(appointment.orderId, config);
          result.sent++;

          logger.info(\`\${config.type} reminder sent successfully\`, {
            orderId: appointment.orderId,
            customerAddress: appointment.customerAddress,
            shopId: appointment.shopId,
            emailEnabled: prefs.emailEnabled,
            inAppEnabled: prefs.inAppEnabled
          });
        } catch (error) {
          const errorMsg = \`Failed to send \${config.type} reminder for order \${appointment.orderId}: \${error instanceof Error ? error.message : 'Unknown error'}\`;
          logger.error(errorMsg, error);
          result.errors.push(errorMsg);
        }
      }
    } catch (error) {
      const errorMsg = \`Failed to process \${config.type} reminders: \${error instanceof Error ? error.message : 'Unknown error'}\`;
      logger.error(errorMsg, error);
      result.errors.push(errorMsg);
    }

    return result;
  }`;

if (oldMethodPattern.test(content)) {
  content = content.replace(oldMethodPattern, newMethod);
  fs.writeFileSync(path, content);
  console.log('processReminderType method updated successfully');
} else {
  console.log('Could not find the method pattern to replace');
}
