export interface ValidationResult {
  valid: boolean;
  recipientExists?: boolean;
}

export interface GiftTokenFormData {
  recipientAddress: string;
  amount: string;
  message: string;
}

export interface TransferParams {
  fromAddress: string;
  toAddress: string;
  amount: number;
  message?: string;
  transactionHash: string;
}

export interface ValidateTransferParams {
  fromAddress: string;
  toAddress: string;
  amount: number;
}
