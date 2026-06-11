// backend/src/domains/AdsDomain/services/industryTaxonomies.ts
//
// Ads System Stage 5 — default service taxonomies per industry. Data only (the
// schema doesn't change). Used to seed shop_services suggestions / AI persona
// hints when onboarding a non-repair shop. Slugs match the `industries` table.

export const INDUSTRY_SERVICE_TAXONOMIES: Record<string, string[]> = {
  repair: ['Screen Repair', 'Battery Replacement', 'Water Damage', 'Diagnostics'],
  landscaping: ['Mow Lawn', 'Trim Hedges', 'Leaf Cleanup', 'Mulching', 'Seasonal Cleanup'],
  gyms: ['Day Pass', 'Monthly Membership', 'Personal Training', 'Class Drop-in'],
  nail_salons: ['Manicure', 'Pedicure', 'Gel Set', 'Nail Art', 'Fill'],
  barbershops: ['Haircut', 'Beard Trim', 'Hot Towel Shave', 'Kids Cut', 'Lineup'],
  lawyers: ['Consultation', 'Document Review', 'Representation', 'Filing'],
  plumbing: ['Leak Repair', 'Drain Cleaning', 'Water Heater', 'Fixture Install'],
  electricians: ['Outlet/Switch', 'Panel Upgrade', 'Lighting Install', 'Troubleshooting'],
};

export function taxonomyFor(slug: string): string[] {
  return INDUSTRY_SERVICE_TAXONOMIES[slug] ?? [];
}
