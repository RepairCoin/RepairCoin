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
  /** Admin-selected objective override (picker). When set + valid, used instead of
   *  deriving from the goal. */
  objective?: string | null;
  /** Pixel "Lead" optimization (opt-in, ADS_OPTIMIZE_FOR_LEAD). When true + a pixelId is
   *  present, a website-clicks campaign is upgraded to OUTCOME_LEADS optimized for the Lead
   *  pixel conversion (still links to our landing page — no instant form). */
  optimizeForPixelLead?: boolean;
  /** The shop's Meta pixel id (shops.meta_pixel_id) — required for the optimization above. */
  pixelId?: string | null;
}

/** Validate an admin-supplied objective string → a supported MetaObjective, or null. */
export function asMetaObjective(value: string | null | undefined): MetaObjective | null {
  switch (value) {
    case 'OUTCOME_TRAFFIC':
    case 'OUTCOME_AWARENESS':
    case 'OUTCOME_LEADS':
      return value;
    default:
      return null;
  }
}

export interface MetaCampaignSpec {
  objective: MetaObjective;
  dailyBudgetCents: number;       // Meta ad-set daily_budget (account minor units)
  optimizationGoal: string;
  billingEvent: string;
  targeting: Record<string, any>; // Meta targeting spec
  /** True when this spec was upgraded to pixel-Lead website-conversion optimization. The push
   *  service uses it to attach the pixel promoted_object and to SKIP the native instant form. */
  conversionOptimized?: boolean;
  /** Pixel id to optimize toward (only set when conversionOptimized). */
  pixelId?: string | null;
}

const DEFAULT_RADIUS_MILES = 10;
const MIN_DAILY_CENTS = 100;      // Meta minimum ≈ $1/day
const MILES_TO_KM = 1.609344;

/** Map the brief goal → Meta objective. v1 default = OUTCOME_TRAFFIC (drive to the shop's
 *  landing page; leads captured by the on-page AdLeadForm → no native instant form, no
 *  leads_retrieval / page Lead-Gen ToS / ON_AD coupling). Native OUTCOME_LEADS instant-form
 *  ads are a documented follow-up — re-enable here once leads_retrieval + form creation are
 *  enabled & hardened. */
export function objectiveForGoal(goal: string | null | undefined): MetaObjective {
  switch ((goal || '').toLowerCase()) {
    case 'awareness': return 'OUTCOME_AWARENESS';
    case 'more_bookings':
    case 'leads':
    case 'traffic':
    default: return 'OUTCOME_TRAFFIC';
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
  // An explicit, valid objective (picker) wins; otherwise derive from the goal.
  const objective = asMetaObjective(input.objective) ?? objectiveForGoal(input.goal);

  // Pixel "Lead" optimization (opt-in): upgrade a website-clicks campaign to an OUTCOME_LEADS
  // website-conversion campaign optimized for the Lead pixel event — delivery tunes toward
  // form-submitters, not clickers. Still links to OUR landing page (no instant form). Only the
  // traffic/clicks case is upgraded; awareness + native-lead-form objectives are left untouched.
  // (OFFSITE_CONVERSIONS is NOT a valid optimization under OUTCOME_TRAFFIC in Meta's ODAX, which
  // is why the objective itself flips to OUTCOME_LEADS here.)
  if (input.optimizeForPixelLead && input.pixelId && objective === 'OUTCOME_TRAFFIC') {
    return {
      objective: 'OUTCOME_LEADS',
      dailyBudgetCents: dailyBudgetCents(input.monthlyBudgetCents),
      optimizationGoal: 'OFFSITE_CONVERSIONS',
      billingEvent: 'IMPRESSIONS',
      targeting: buildTargeting(input),
      conversionOptimized: true,
      pixelId: input.pixelId,
    };
  }

  const { optimizationGoal, billingEvent } = optimizationForObjective(objective);
  return {
    objective,
    dailyBudgetCents: dailyBudgetCents(input.monthlyBudgetCents),
    optimizationGoal,
    billingEvent,
    targeting: buildTargeting(input),
  };
}
