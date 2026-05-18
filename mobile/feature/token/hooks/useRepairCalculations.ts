import { useState } from "react";

export type RepairType = "minor" | "small" | "large" | "custom";

const TIER_BONUSES = {
  BRONZE: 0,
  SILVER: 2,
  GOLD: 5,
} as const;

const MINOR_REPAIR_RCN = 5;
const SMALL_REPAIR_RCN = 10;
const LARGE_REPAIR_RCN = 15;
const MINOR_REPAIR_VALUE = 30;
const SMALL_REPAIR_VALUE = 75;
const LARGE_REPAIR_VALUE = 100;

export function useRepairCalculations() {
  const [repairType, setRepairType] = useState<RepairType>("small");
  const [customAmount, setCustomAmount] = useState("");
  const [customRcn, setCustomRcn] = useState("");

  const calculateBaseReward = () => {
    if (repairType === "custom") {
      const rcn = parseFloat(customRcn);
      return isNaN(rcn) ? 0 : rcn;
    }
    switch (repairType) {
      case "minor":
        return MINOR_REPAIR_RCN;
      case "small":
        return SMALL_REPAIR_RCN;
      case "large":
        return LARGE_REPAIR_RCN;
      default:
        return 0;
    }
  };

  const getRepairAmount = () => {
    if (repairType === "custom") {
      return parseFloat(customAmount) || 0;
    }
    switch (repairType) {
      case "minor":
        return MINOR_REPAIR_VALUE;
      case "small":
        return SMALL_REPAIR_VALUE;
      case "large":
        return LARGE_REPAIR_VALUE;
      default:
        return 0;
    }
  };

  const getTierBonus = (tier?: string) => {
    return (
      TIER_BONUSES[tier as keyof typeof TIER_BONUSES] || TIER_BONUSES.BRONZE
    );
  };

  return {
    repairType,
    setRepairType,
    customAmount,
    setCustomAmount,
    customRcn,
    setCustomRcn,
    calculateBaseReward,
    getRepairAmount,
    getTierBonus,
  };
}
