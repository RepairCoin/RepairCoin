export type CopyableFieldProps = {
  value: string;
  isCopied: boolean;
  handleCopyValue: () => void;
};

export interface TierConfig {
  color: [string, string];
  label: string;
  bonus: number;
  requirement: number;
}

export interface TierProgressCardProps {
  currentTier: string;
  lifetimeEarnings: number;
}
