// backend/src/domains/ServiceDomain/constants.ts

/**
 * Valid service categories for the marketplace.
 * Used for validation on create/update and as a DB CHECK constraint.
 */
export const VALID_CATEGORIES = [
  'repairs',
  'beauty_personal_care',
  'health_wellness',
  'fitness_gyms',
  'automotive_services',
  'home_cleaning_services',
  'pets_animal_care',
  'professional_services',
  'education_classes',
  'tech_it_services',
  'food_beverage',
  'other_local_services',
] as const;

export type ServiceCategory = (typeof VALID_CATEGORIES)[number];
