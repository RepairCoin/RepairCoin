import { useState, useEffect } from "react";
import { useDebounce } from "../../../../shared/hooks";
import { useValidatePromoCode } from "./usePromoCodeQuery";

export function usePromoCodeManager(
  customerAddress: string,
  baseReward: number,
  tierBonus: number
) {
  const [promoCode, setPromoCode] = useState("");
  const [promoBonus, setPromoBonus] = useState(0);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [showPromoDropdown, setShowPromoDropdown] = useState(false);

  // Debounce the raw input so validation only fires after the user stops typing.
  const debouncedPromoCode = useDebounce(promoCode, 500);

  const validatePromo = useValidatePromoCode();

  useEffect(() => {
    let cancelled = false;

    const fetchPromoBonus = async () => {
      if (!debouncedPromoCode || !debouncedPromoCode.trim() || !customerAddress) {
        setPromoBonus(0);
        setPromoError(null);
        return;
      }

      setPromoError(null);
      try {
        const result = await validatePromo.mutateAsync({
          code: debouncedPromoCode.trim(),
          customerAddress,
        });

        if (cancelled) return;

        if (result.success && result.data?.is_valid) {
          const rewardBeforePromo = baseReward + tierBonus;
          let bonusAmount = 0;

          if (result.data?.bonus_type === "fixed") {
            bonusAmount = parseFloat(result.data?.bonus_value || "0") || 0;
          } else if (result.data?.bonus_type === "percentage") {
            bonusAmount =
              (rewardBeforePromo *
                (parseFloat(result.data?.bonus_value || "0") || 0)) /
              100;
          }

          if (result.data?.max_bonus) {
            const maxBonus = parseFloat(result.data?.max_bonus);
            if (!isNaN(maxBonus) && bonusAmount > maxBonus) {
              bonusAmount = maxBonus;
            }
          }

          setPromoBonus(bonusAmount);
          setPromoError(null);
        } else {
          setPromoBonus(0);
          setPromoError(result.data?.error_message || "Invalid promo code");
        }
      } catch (err: any) {
        if (cancelled) return;
        setPromoBonus(0);
        setPromoError("Failed to validate promo code");
      }
    };

    fetchPromoBonus();

    return () => {
      cancelled = true;
    };
  }, [debouncedPromoCode, customerAddress, baseReward, tierBonus]);

  return {
    promoCode,
    setPromoCode,
    promoBonus,
    promoError,
    showPromoDropdown,
    setShowPromoDropdown,
    isValidatingPromo: validatePromo.isPending,
  };
}
