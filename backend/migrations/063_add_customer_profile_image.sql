-- Migration: Add profile_image_url to customers table
-- Description: Allows customers to upload and store a profile image

ALTER TABLE customers ADD COLUMN IF NOT EXISTS profile_image_url VARCHAR(512);
