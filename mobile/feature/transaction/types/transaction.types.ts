/**
 * Shared transaction types across booking, token, and appointment sub-domains.
 */
export interface TransactionSummary {
  totalBookings: number;
  totalTokenTransactions: number;
  totalAppointments: number;
}
