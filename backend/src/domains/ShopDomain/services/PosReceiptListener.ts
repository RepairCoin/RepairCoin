import { eventBus } from '../../../events/EventBus';
import { logger } from '../../../utils/logger';
import { customerRepository, posSaleRepository, shopRepository } from '../../../repositories';
import { getNotificationGateway } from '../../notification/services/NotificationGateway';
import { EmailService } from '../../../services/EmailService';
import { warrantyLabel } from '../../../utils/warranty';
import type { PosTenderMethod, PosSaleWithDetails } from '../../../repositories/PosSaleRepository';

/**
 * Sends the customer their copy of a counter-sale receipt.
 *
 * Two independent deliveries, because they serve two different people. A registered customer gets
 * it in the app (and on their phone) where the rest of their history lives; anyone who gave an
 * email at the register gets it in their inbox, account or not. A walk-in who gave neither gets
 * nothing, which is the common case at a counter and not an error — the cashier's on-screen
 * receipt is already the shop's record.
 *
 * Everything here runs after the money is taken. A failure is logged and swallowed: the sale is
 * closed and the customer has gone, so there is nothing a retry could rescue and nothing the
 * register could usefully be told.
 */
interface PosSaleCompletedEvent {
  data: {
    saleId: string;
    shopId: string;
    customerAddress: string | null;
    saleNumber: number | null;
    totalCents: number;
  };
}

const TENDER_LABELS: Record<PosTenderMethod, string> = {
  card: 'Card',
  cash: 'Cash',
  gift_card: 'Gift card',
  rcn: 'RCN',
  other: 'Other',
};

const emailService = new EmailService();

const money = (cents: number): string => `$${(cents / 100).toFixed(2)}`;

export async function sendReceiptForSale(event: PosSaleCompletedEvent): Promise<void> {
  const { saleId, shopId, customerAddress } = event.data;

  try {
    const sale = await posSaleRepository.getSale(saleId, shopId);
    if (!sale) {
      logger.warn('POS receipt: sale disappeared before the receipt was built', { saleId, shopId });
      return;
    }

    const shopName = (await shopRepository.getShop(shopId))?.name || 'the shop';

    // The address typed at the register wins over the one on file: it is the one the person
    // standing at the counter just asked for, and may not be theirs at all (a gift, a company card).
    let email = sale.receiptEmail;
    if (customerAddress) {
      const customer = await customerRepository.getCustomer(customerAddress);
      if (!email && customer?.email) email = customer.email;

      await dispatchInApp(sale, customerAddress, shopName);
    }

    if (email) await sendEmail(sale, email, shopName);
  } catch (error) {
    logger.error('POS receipt: failed to send', {
      saleId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function dispatchInApp(
  sale: PosSaleWithDetails,
  customerAddress: string,
  shopName: string
): Promise<void> {
  try {
    await getNotificationGateway().dispatch('pos_sale_receipt', customerAddress, {
      message: `You paid ${money(sale.totalCents)} at ${shopName}.`,
      metadata: {
        saleId: sale.id,
        shopId: sale.shopId,
        shopName,
        saleNumber: sale.saleNumber,
        totalCents: sale.totalCents,
        totalLabel: money(sale.totalCents),
        itemCount: sale.items.length,
      },
    });
  } catch (error) {
    logger.error('POS receipt: in-app notification failed', {
      saleId: sale.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function sendEmail(
  sale: PosSaleWithDetails,
  email: string,
  shopName: string
): Promise<void> {
  // Only settled tenders appear. A failed or cancelled attempt is register noise the customer
  // never needs to see, and showing it would make the tenders fail to sum to the total.
  const settled = sale.payments.filter((payment) => payment.status === 'succeeded');

  const sent = await emailService.sendPosReceipt({
    customerEmail: email,
    shopName,
    saleNumber: sale.saleNumber,
    completedAt: sale.completedAt ? new Date(sale.completedAt) : new Date(),
    items: sale.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      totalCents: item.totalCents,
      warrantyLabel: warrantyLabel(sale.completedAt, item.warrantyDays) ?? undefined,
    })),
    subtotalCents: sale.subtotalCents,
    discountCents: sale.discountCents,
    taxCents: sale.taxCents,
    totalCents: sale.totalCents,
    tenders: settled.map((payment) => ({
      label: TENDER_LABELS[payment.method] || 'Payment',
      amountCents: payment.amountCents,
    })),
    changeCents: settled.reduce((sum, payment) => sum + (payment.changeCents ?? 0), 0),
  });

  if (!sent) {
    logger.warn('POS receipt: email was not accepted', { saleId: sale.id });
    return;
  }

  await posSaleRepository.markReceiptSent(sale.id);
  logger.info('POS receipt: emailed', { saleId: sale.id, shopId: sale.shopId });
}

export function setupPosReceiptListener(): void {
  eventBus.subscribe('pos.sale_completed', sendReceiptForSale, 'ShopDomain:PosReceipt');
  logger.info('POS sale listener registered for receipts');
}
