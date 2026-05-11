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

  useEffect(() => {
    setInputValue(purchaseAmount > 0 ? purchaseAmount.toString() : "");
  }, [purchaseAmount]);

  const MAX_AMOUNT = 100000;

  const handleInputChange = useCallback(
    (text: string) => {
      if (!text) {
        setInputValue("");
        setPurchaseAmount(0);
        setShowExceedError(false);
        return;
      }

      const value = parseInt(text) || 0;

      if (value > MAX_AMOUNT) {
        setShowExceedError(true);
        setInputValue(text);
        setPurchaseAmount(MAX_AMOUNT);
      } else {
        setShowExceedError(false);
        setInputValue(text);
        setPurchaseAmount(value);
      }
    },
    [setPurchaseAmount]
  );

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

  const selectQuickAmount = useCallback(
    (amount: number) => {
      setPurchaseAmount(amount);
    },
    [setPurchaseAmount]
  );

  return {
    purchaseAmount,
    setPurchaseAmount,
    inputValue,
    handleInputChange,
    bonusAmount,
    totalCost,
    totalTokens,
    effectiveRate,
    isValidAmount,
    showExceedError,
    selectQuickAmount,
    showHowItWorks,
    openHowItWorks,
    closeHowItWorks,
    showSubscriptionModal,
    openSubscriptionModal,
    closeSubscriptionModal,
  };
}
