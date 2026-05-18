import { useState, useEffect } from "react";
import { useValidatePromoCode } from "../../../token/hooks/useTokensMutation";

export function usePromoCodeManager(
  customerAddress: string,
  baseReward: number,
  tierBonus: number
) {
  const [promoCode, setPromoCode] = useState("");
  const [promoBonus, setPromoBonus] = useState(0);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [showPromoDropdown, setShowPromoDropdown] = useState(false);

  const validatePromo = useValidatePromoCode();

  useEffect(() => {
    let timeoutId: number;

    const fetchPromoBonus = async () => {
      if (!promoCode || !promoCode.trim() || !customerAddress) {
        setPromoBonus(0);
        setPromoError(null);
        return;
      }

      setPromoError(null);
      try {
        const result = await validatePromo.mutateAsync({
          code: promoCode.trim(),
          customerAddress,
        });

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
        setPromoBonus(0);
        setPromoError("Failed to validate promo code");
      }
    };

    if (promoCode && customerAddress) {
      timeoutId = setTimeout(fetchPromoBonus, 500);
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [promoCode, customerAddress, baseReward, tierBonus, validatePromo]);

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
