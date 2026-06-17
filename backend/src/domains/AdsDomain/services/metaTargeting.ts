// backend/src/domains/AdsDomain/services/metaTargeting.ts
//
// PURE builders that turn a campaign request + shop geo into a Meta campaign/ad-set spec —
// so "no manual inputs" has a deterministic, unit-tested source of truth. No IO here.
// Default objective is OUTCOME_LEADS (locked): the lead pipeline is the only path with
// measurable ROI. Geo comes from the shop's lat/lng + the request radius. (Interest targeting
// needs real Meta interest IDs via the Targeting Search API — a later refinement, not v1.)

export type MetaObjective = 'OUTCOME_LEADS' | 'OUTCOME_AWARENESS' | 'OUTCOME_TRAFFIC';

export interface CampaignSpecInput {
  goal: string | null;            // request.goal
  monthlyBudgetCents: number | null;
  targetRadiusMiles: number | null;
  lat: number | null;
  lng: number | null;
}

export interface MetaCampaignSpec {
  objective: MetaObjective;
  dailyBudgetCents: number;       // Meta ad-set daily_budget (account minor units)
  optimizationGoal: string;
  billingEvent: string;
  targeting: Record<string, any>; // Meta targeting spec
}

const DEFAULT_RADIUS_MILES = 10;
const MIN_DAILY_CENTS = 100;      // Meta minimum ≈ $1/day
const MILES_TO_KM = 1.609344;

/** Map the brief goal → Meta objective. Unset/ambiguous → OUTCOME_LEADS (locked default). */
export function objectiveForGoal(goal: string | null | undefined): MetaObjective {
  switch ((goal || '').toLowerCase()) {
    case 'awareness': return 'OUTCOME_AWARENESS';
    case 'traffic': return 'OUTCOME_TRAFFIC';
    case 'more_bookings':
    case 'leads':
    default: return 'OUTCOME_LEADS';
  }
}

/** Optimization goal + billing event per objective. */
export function optimizationForObjective(objective: MetaObjective): { optimizationGoal: string; billingEvent: string } {
  switch (objective) {
    case 'OUTCOME_AWARENESS': return { optimizationGoal: 'REACH', billingEvent: 'IMPRESSIONS' };
    case 'OUTCOME_TRAFFIC': return { optimizationGoal: 'LINK_CLICKS', billingEvent: 'IMPRESSIONS' };
    case 'OUTCOME_LEADS':
    default: return { optimizationGoal: 'LEAD_GENERATION', billingEvent: 'IMPRESSIONS' };
  }
}

/** Monthly budget → daily ad-set budget (cents), clamped to Meta's minimum. */
export function dailyBudgetCents(monthlyBudgetCents: number | null): number {
  const monthly = monthlyBudgetCents ?? 0;
  return Math.max(MIN_DAILY_CENTS, Math.round(monthly / 30));
}

/** Build the Meta targeting spec. Uses a radius custom_location when lat/lng present. */
export function buildTargeting(input: CampaignSpecInput): Record<string, any> {
  const targeting: Record<string, any> = { age_min: 18, age_max: 65 };
  if (input.lat != null && input.lng != null) {
    const radiusMi = input.targetRadiusMiles ?? DEFAULT_RADIUS_MILES;
    targeting.geo_locations = {
      custom_locations: [{
        latitude: input.lat,
        longitude: input.lng,
        radius: Math.round(radiusMi * MILES_TO_KM), // Meta radius in km (1-80)
        distance_unit: 'kilometer',
      }],
      location_types: ['home', 'recent'],
    };
  }
  return targeting;
}

/** Assemble the full spec the push service feeds to the Marketing API. */
export function buildCampaignSpec(input: CampaignSpecInput): MetaCampaignSpec {
  const objective = objectiveForGoal(input.goal);
  const { optimizationGoal, billingEvent } = optimizationForObjective(objective);
  return {
    objective,
    dailyBudgetCents: dailyBudgetCents(input.monthlyBudgetCents),
    optimizationGoal,
    billingEvent,
    targeting: buildTargeting(input),
  };
}
