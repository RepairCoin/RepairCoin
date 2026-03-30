-- Migration: Add CHECK constraint for service category validation
-- Ensures only valid categories can be stored in shop_services.category
-- Also sets category NOT NULL for data integrity (controller already enforces this)

-- Step 1: Fix any existing rows with NULL or invalid categories before adding constraint
UPDATE shop_services
SET category = 'other_local_services'
WHERE category IS NULL
   OR category NOT IN (
     'repairs', 'beauty_personal_care', 'health_wellness', 'fitness_gyms',
     'automotive_services', 'home_cleaning_services', 'pets_animal_care',
     'professional_services', 'education_classes', 'tech_it_services',
     'food_beverage', 'other_local_services'
   );

-- Step 2: Add NOT NULL constraint
ALTER TABLE shop_services ALTER COLUMN category SET NOT NULL;

-- Step 3: Add CHECK constraint
ALTER TABLE shop_services ADD CONSTRAINT chk_service_category
CHECK (category IN (
  'repairs', 'beauty_personal_care', 'health_wellness', 'fitness_gyms',
  'automotive_services', 'home_cleaning_services', 'pets_animal_care',
  'professional_services', 'education_classes', 'tech_it_services',
  'food_beverage', 'other_local_services'
));
