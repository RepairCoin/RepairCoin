export type SetCampaignRewardConfig = {
  rewardType: 'none' | 'rcn' | 'coupon';
  rewardMode: 'flat' | 'by_tier' | 'by_spend' | null;
  rewardRcnAmount: number | null;
  rewardRcnByTier: Record<string, number> | null;
  rewardSpendBands: Array<{ minSpend: number; rcn: number }> | null;
  fulfillmentTrigger: 'on_send' | 'on_return';
  returnWindowDays: number | null;
  // Coupon reward: bonus RCN granted by a one-per-customer code minted at send.
  // These ride on the campaign's coupon_* columns, not the reward ledger.
  couponValue: number | null;
  couponExpiresAt: Date | null;
};

const COUPON_RCN_MAX = 10000;
const COUPON_EXPIRES_DAYS_DEFAULT = 60;

export type CampaignRewardInput =
  | { action: 'ignore' }
  | { action: 'clear'; config: SetCampaignRewardConfig }
  | { action: 'set'; config: SetCampaignRewardConfig };

export function rewardInputWrites(
  input: CampaignRewardInput
): input is { action: 'set'; config: SetCampaignRewardConfig } {
  return input.action === 'set';
}

export class CampaignRewardInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CampaignRewardInputError';
  }
}

const CLEARED: SetCampaignRewardConfig = {
  rewardType: 'none',
  rewardMode: null,
  rewardRcnAmount: null,
  rewardRcnByTier: null,
  rewardSpendBands: null,
  fulfillmentTrigger: 'on_send',
  returnWindowDays: null,
  couponValue: null,
  couponExpiresAt: null,
};

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

export function parseCampaignRewardInput(reward: unknown): CampaignRewardInput {
  if (reward === undefined) {
    return { action: 'ignore' };
  }
  if (reward === null) {
    return { action: 'clear', config: { ...CLEARED } };
  }
  if (typeof reward !== 'object') {
    throw new CampaignRewardInputError('reward must be an object, null, or omitted');
  }

  const r = reward as Record<string, unknown>;
  const type = r.type;

  if (type === undefined || type === 'none') {
    return { action: 'clear', config: { ...CLEARED } };
  }
  if (type === 'coupon') {
    if (!isFiniteNumber(r.couponValue) || r.couponValue <= 0) {
      throw new CampaignRewardInputError('Coupon reward requires couponValue (bonus RCN) > 0');
    }
    if (r.couponValue > COUPON_RCN_MAX) {
      throw new CampaignRewardInputError(`Coupon bonus RCN cannot exceed ${COUPON_RCN_MAX}`);
    }
    let days = COUPON_EXPIRES_DAYS_DEFAULT;
    if (r.couponExpiresDays !== undefined) {
      if (!isFiniteNumber(r.couponExpiresDays) || r.couponExpiresDays <= 0) {
        throw new CampaignRewardInputError('couponExpiresDays must be a number > 0');
      }
      days = Math.min(365, Math.round(r.couponExpiresDays));
    }
    return {
      action: 'set',
      config: {
        ...CLEARED,
        rewardType: 'coupon',
        couponValue: r.couponValue,
        couponExpiresAt: new Date(Date.now() + days * 86400000),
      },
    };
  }
  if (type !== 'rcn') {
    throw new CampaignRewardInputError(`Unsupported reward type: ${String(type)}`);
  }

  const mode = r.mode;
  if (mode !== 'flat' && mode !== 'by_tier' && mode !== 'by_spend') {
    throw new CampaignRewardInputError("reward.mode must be 'flat', 'by_tier', or 'by_spend'");
  }

  let rewardRcnAmount: number | null = null;
  let rewardRcnByTier: Record<string, number> | null = null;
  let rewardSpendBands: Array<{ minSpend: number; rcn: number }> | null = null;

  if (mode === 'flat') {
    if (!isFiniteNumber(r.rcnAmount) || r.rcnAmount <= 0) {
      throw new CampaignRewardInputError('Flat reward requires rcnAmount > 0');
    }
    rewardRcnAmount = r.rcnAmount;
  } else if (mode === 'by_tier') {
    const byTier = r.rcnByTier;
    if (!byTier || typeof byTier !== 'object' || Array.isArray(byTier)) {
      throw new CampaignRewardInputError('By-tier reward requires an rcnByTier object');
    }
    const entries = Object.entries(byTier as Record<string, unknown>);
    if (entries.length === 0) {
      throw new CampaignRewardInputError('By-tier reward requires at least one tier amount');
    }
    const cleaned: Record<string, number> = {};
    for (const [tier, value] of entries) {
      if (!isFiniteNumber(value) || value < 0) {
        throw new CampaignRewardInputError(`By-tier amount for "${tier}" must be a number >= 0`);
      }
      cleaned[tier] = value;
    }
    if (!Object.values(cleaned).some((v) => v > 0)) {
      throw new CampaignRewardInputError('By-tier reward needs at least one tier with amount > 0');
    }
    rewardRcnByTier = cleaned;
  } else {
    const bands = r.spendBands;
    if (!Array.isArray(bands) || bands.length === 0) {
      throw new CampaignRewardInputError('By-spend reward requires a non-empty spendBands array');
    }
    const cleaned: Array<{ minSpend: number; rcn: number }> = [];
    for (const band of bands) {
      const b = band as Record<string, unknown>;
      if (!isFiniteNumber(b?.minSpend) || b.minSpend < 0) {
        throw new CampaignRewardInputError('Each spend band requires minSpend >= 0');
      }
      if (!isFiniteNumber(b?.rcn) || b.rcn < 0) {
        throw new CampaignRewardInputError('Each spend band requires rcn >= 0');
      }
      cleaned.push({ minSpend: b.minSpend, rcn: b.rcn });
    }
    if (!cleaned.some((b) => b.rcn > 0)) {
      throw new CampaignRewardInputError('By-spend reward needs at least one band with rcn > 0');
    }
    rewardSpendBands = cleaned;
  }

  const fulfillmentRaw = r.fulfillment;
  if (fulfillmentRaw !== undefined && fulfillmentRaw !== 'on_send' && fulfillmentRaw !== 'on_return') {
    throw new CampaignRewardInputError("reward.fulfillment must be 'on_send' or 'on_return'");
  }
  const fulfillment: 'on_send' | 'on_return' = fulfillmentRaw === 'on_return' ? 'on_return' : 'on_send';

  let returnWindowDays: number | null = null;
  if (fulfillment === 'on_return') {
    if (!isFiniteNumber(r.returnWindowDays) || r.returnWindowDays <= 0) {
      throw new CampaignRewardInputError('On-return rewards require returnWindowDays > 0');
    }
    returnWindowDays = Math.min(365, Math.round(r.returnWindowDays));
  }

  return {
    action: 'set',
    config: {
      rewardType: 'rcn',
      rewardMode: mode,
      rewardRcnAmount,
      rewardRcnByTier,
      rewardSpendBands,
      fulfillmentTrigger: fulfillment,
      returnWindowDays,
      couponValue: null,
      couponExpiresAt: null,
    },
  };
}
