// Pure tests for the Stage-4 push targeting builder (Phase 1). The Graph create calls are
// verified manually against a Meta test ad account (no creds in CI).

import {
  objectiveForGoal, optimizationForObjective, dailyBudgetCents, buildTargeting, buildCampaignSpec,
} from '../../src/domains/AdsDomain/services/metaTargeting';

describe('objectiveForGoal', () => {
  it('maps awareness; v1 routes lead/bookings/traffic → OUTCOME_TRAFFIC', () => {
    expect(objectiveForGoal('awareness')).toBe('OUTCOME_AWARENESS');
    expect(objectiveForGoal('traffic')).toBe('OUTCOME_TRAFFIC');
    expect(objectiveForGoal('more_bookings')).toBe('OUTCOME_TRAFFIC');
    expect(objectiveForGoal('leads')).toBe('OUTCOME_TRAFFIC');
  });
  it('defaults unset/ambiguous to OUTCOME_TRAFFIC (v1 — native lead forms deferred)', () => {
    expect(objectiveForGoal(null)).toBe('OUTCOME_TRAFFIC');
    expect(objectiveForGoal('something_else')).toBe('OUTCOME_TRAFFIC');
  });
});

describe('optimizationForObjective', () => {
  it('uses LEAD_GENERATION for leads', () => {
    expect(optimizationForObjective('OUTCOME_LEADS').optimizationGoal).toBe('LEAD_GENERATION');
  });
  it('uses REACH for awareness, LINK_CLICKS for traffic', () => {
    expect(optimizationForObjective('OUTCOME_AWARENESS').optimizationGoal).toBe('REACH');
    expect(optimizationForObjective('OUTCOME_TRAFFIC').optimizationGoal).toBe('LINK_CLICKS');
  });
});

describe('dailyBudgetCents', () => {
  it('divides monthly by 30', () => {
    expect(dailyBudgetCents(300000)).toBe(10000); // $3000/mo → $100/day
  });
  it('clamps to the Meta minimum (~$1/day)', () => {
    expect(dailyBudgetCents(0)).toBe(100);
    expect(dailyBudgetCents(null)).toBe(100);
    expect(dailyBudgetCents(900)).toBe(100); // $9/mo → $0.30/day → clamped to $1
  });
});

describe('buildTargeting', () => {
  it('builds a radius custom_location from lat/lng + miles (converted to km)', () => {
    const t = buildTargeting({ goal: 'leads', monthlyBudgetCents: 30000, targetRadiusMiles: 12, lat: 40.1, lng: -74.2 });
    const loc = t.geo_locations.custom_locations[0];
    expect(loc.latitude).toBe(40.1);
    expect(loc.longitude).toBe(-74.2);
    expect(loc.radius).toBe(Math.round(12 * 1.609344)); // ≈19 km
    expect(loc.distance_unit).toBe('kilometer');
    expect(t.age_min).toBe(18);
  });
  it('omits geo when lat/lng missing (falls back to broad)', () => {
    const t = buildTargeting({ goal: 'leads', monthlyBudgetCents: 30000, targetRadiusMiles: 12, lat: null, lng: null });
    expect(t.geo_locations).toBeUndefined();
    expect(t.age_min).toBe(18);
  });
});

describe('buildCampaignSpec', () => {
  it('assembles objective + budget + optimization + targeting', () => {
    const spec = buildCampaignSpec({ goal: null, monthlyBudgetCents: 300000, targetRadiusMiles: 10, lat: 1, lng: 2 });
    expect(spec.objective).toBe('OUTCOME_TRAFFIC');
    expect(spec.dailyBudgetCents).toBe(10000);
    expect(spec.optimizationGoal).toBe('LINK_CLICKS');
    expect(spec.billingEvent).toBe('IMPRESSIONS');
    expect(spec.targeting.geo_locations.custom_locations[0].radius).toBe(Math.round(10 * 1.609344));
  });
});
