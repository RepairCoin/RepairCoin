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
  const MIN_AMOUNT = 5;

  // Handle input change
  const handleInputChange = useCallback(
    (text: string) => {
      // Allow empty input
      if (!text) {
        setInputValue("");
        setPurchaseAmount(0);
        setShowExceedError(false);
        return;
      }

      const value = parseInt(text) || 0;

      // Show error if exceeds max, but don't clamp the input immediately
      // This lets user see what they typed and understand the error
      if (value > MAX_AMOUNT) {
        setShowExceedError(true);
        setInputValue(text);
        setPurchaseAmount(MAX_AMOUNT); // Clamp the actual purchase amount
      } else {
        setShowExceedError(false);
        setInputValue(text);
        setPurchaseAmount(value);
      }
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
