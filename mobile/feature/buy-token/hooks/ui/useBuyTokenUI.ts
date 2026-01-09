import { useState, useEffect, useCallback } from "react";
import { usePurchase } from "@/hooks/purchase/usePurchase";

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

  // Sync input value with purchase amount
  useEffect(() => {
    setInputValue(purchaseAmount > 0 ? purchaseAmount.toString() : "");
  }, [purchaseAmount]);

  // Handle input change
  const handleInputChange = useCallback(
    (text: string) => {
      setInputValue(text);
      const value = parseInt(text) || 0;
      setPurchaseAmount(Math.max(0, value));
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
