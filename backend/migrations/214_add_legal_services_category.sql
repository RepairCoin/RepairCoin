-- Migration: Add 'legal_services' to the service category CHECK constraint
-- Extends chk_service_category (originally added in 095) with a 13th category.
-- No backfill / NOT NULL steps needed — category is already NOT NULL and existing
-- values remain valid.

-- Recreate the constraint with the new value included
ALTER TABLE shop_services DROP CONSTRAINT IF EXISTS chk_service_category;

ALTER TABLE shop_services ADD CONSTRAINT chk_service_category
CHECK (category IN (
  'repairs', 'beauty_personal_care', 'health_wellness', 'fitness_gyms',
  'automotive_services', 'home_cleaning_services', 'pets_animal_care',
  'professional_services', 'education_classes', 'tech_it_services',
  'food_beverage', 'legal_services', 'other_local_services'
));
