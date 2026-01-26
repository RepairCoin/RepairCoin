import { useState, useEffect, useCallback } from "react";
import { usePurchase } from "./usePurchase";

export function useBuyTokenUI() {
  const { usePurchaseAmount } = usePurchase();
  const {
    amount: purchaseAmount,
    setAmount: setPurchaseAmount,
    bonusAmount,
    totalCost,
    totalTokens,
    effectiveRate,
    isValidAmount,
  } = usePurchaseAmount();

  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [inputValue, setInputValue] = useState(purchaseAmount.toString());
  const [showExceedError, setShowExceedError] = useState(false);

  // Sync input value with purchase amount
  useEffect(() => {
    setInputValue(purchaseAmount > 0 ? purchaseAmount.toString() : "");
  }, [purchaseAmount]);

  const MAX_AMOUNT = 100000;

  // Handle input change
  const handleInputChange = useCallback(
    (text: string) => {
      const value = parseInt(text) || 0;
      const clampedValue = Math.min(Math.max(0, value), MAX_AMOUNT);

      // If value exceeds max, show clamped value in input and error message
      if (value > MAX_AMOUNT) {
        setInputValue(MAX_AMOUNT.toString());
        setShowExceedError(true);
        // Auto-dismiss error after 3 seconds
        setTimeout(() => setShowExceedError(false), 3000);
      } else {
        setInputValue(text);
        setShowExceedError(false);
      }

      setPurchaseAmount(clampedValue);
    },
    [setPurchaseAmount]
  );

  // Modal handlers
  const openHowItWorks = useCallback(() => setShowHowItWorks(true), []);
  const closeHowItWorks = useCallback(() => setShowHowItWorks(false), []);
  const openSubscriptionModal = useCallback(
    () => setShowSubscriptionModal(true),
    []
  );
  const closeSubscriptionModal = useCallback(
    () => setShowSubscriptionModal(false),
    []
  );

  // Quick amount selection
  const selectQuickAmount = useCallback(
    (amount: number) => {
      setPurchaseAmount(amount);
    },
    [setPurchaseAmount]
  );

  return {
    // Purchase amount state
    purchaseAmount,
    setPurchaseAmount,
    inputValue,
    handleInputChange,
    bonusAmount,
    totalCost,
    totalTokens,
    effectiveRate,
    isValidAmount,
    // Exceed error
    showExceedError,
    // Quick amounts
    selectQuickAmount,
    // How It Works modal
    showHowItWorks,
    openHowItWorks,
    closeHowItWorks,
    // Subscription modal
    showSubscriptionModal,
    openSubscriptionModal,
    closeSubscriptionModal,
  };
}
