import { useState } from "react";

export const usePurchaseAmount = (initialAmount = 5) => {
  const [amount, setAmount] = useState(initialAmount);

  const bonusAmount =
    amount >= 10000
      ? Math.floor(amount * 0.05)
      : amount >= 5000
        ? Math.floor(amount * 0.03)
        : amount >= 1000
          ? Math.floor(amount * 0.02)
          : 0;

  const totalCost = amount * 0.1;
  const totalTokens = amount + bonusAmount;
  const effectiveRate =
    totalTokens > 0 ? (totalCost / totalTokens).toFixed(3) : "0.100";

  return {
    amount,
    setAmount,
    bonusAmount,
    totalCost,
    totalTokens,
    effectiveRate,
    isValidAmount: amount >= 5 && amount <= 100000,
  };
};
