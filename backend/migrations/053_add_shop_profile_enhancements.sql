-- Migration: Add shop profile enhancements (banner, about, gallery)
-- This enables shops to customize their profile with banner images, about text, and photo galleries

-- Add banner_url and about_text to shops table
ALTER TABLE shops
ADD COLUMN IF NOT EXISTS banner_url VARCHAR(512),
ADD COLUMN IF NOT EXISTS about_text TEXT;

-- Add comments for documentation
COMMENT ON COLUMN shops.banner_url IS 'URL to shop banner image (1200x300px) stored in DigitalOcean Spaces';
COMMENT ON COLUMN shops.about_text IS 'Rich text about section describing the shop (max 2000 characters)';

-- Create shop_gallery_photos table
CREATE TABLE IF NOT EXISTS shop_gallery_photos (
  id SERIAL PRIMARY KEY,
  shop_id VARCHAR(255) NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
  photo_url VARCHAR(512) NOT NULL,
  caption TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_shop_gallery_photos_shop_id ON shop_gallery_photos(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_gallery_photos_order ON shop_gallery_photos(shop_id, display_order);

-- Add comments
COMMENT ON TABLE shop_gallery_photos IS 'Photo gallery for shop profiles (max 20 photos per shop)';
COMMENT ON COLUMN shop_gallery_photos.photo_url IS 'URL to photo stored in DigitalOcean Spaces';
COMMENT ON COLUMN shop_gallery_photos.caption IS 'Optional caption for the photo (max 200 characters)';
COMMENT ON COLUMN shop_gallery_photos.display_order IS 'Display order (0 = first, higher numbers shown later)';

-- Create trigger to enforce 20 photo limit
CREATE OR REPLACE FUNCTION check_shop_gallery_photos_limit()
RETURNS TRIGGER AS $$
DECLARE
  photo_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO photo_count
  FROM shop_gallery_photos
  WHERE shop_id = NEW.shop_id;

  IF photo_count >= 20 THEN
    RAISE EXCEPTION 'Shop can have a maximum of 20 gallery photos'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_shop_gallery_photos_limit ON shop_gallery_photos;
CREATE TRIGGER trigger_check_shop_gallery_photos_limit
BEFORE INSERT ON shop_gallery_photos
FOR EACH ROW
EXECUTE FUNCTION check_shop_gallery_photos_limit();

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_shop_gallery_photos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_shop_gallery_photos_updated_at ON shop_gallery_photos;
CREATE TRIGGER trigger_update_shop_gallery_photos_updated_at
BEFORE UPDATE ON shop_gallery_photos
FOR EACH ROW
EXECUTE FUNCTION update_shop_gallery_photos_updated_at();

-- Log the migration
DO $$
BEGIN
    RAISE NOTICE 'Shop profile enhancements added successfully';
    RAISE NOTICE 'Added columns: banner_url, about_text';
    RAISE NOTICE 'Created table: shop_gallery_photos';
END $$;
