# DigitalOcean Spaces Setup Guide

This guide explains how to configure DigitalOcean Spaces for image storage in the RepairCoin backend.

## What is DigitalOcean Spaces?

DigitalOcean Spaces is an S3-compatible object storage service that provides:
- Scalable storage for images, files, and other assets
- CDN integration for fast global delivery
- Simple pricing: $5/month for 250GB storage and 1TB transfer
- S3-compatible API (works with AWS SDK)

## Setup Instructions

### 1. Create a DigitalOcean Space

1. Log in to your DigitalOcean account
2. Go to **Spaces** in the left sidebar
3. Click **Create Space**
4. Configure your Space:
   - **Choose a datacenter region**: Select closest to your users (e.g., `nyc3`, `sfo3`, `sgp1`)
   - **Enable CDN**: Yes (recommended for faster image delivery)
   - **Choose a unique name**: e.g., `repaircoin-images`
   - **Choose file listing**: Private (recommended) or Public
5. Click **Create Space**

### 2. Generate API Keys

1. Go to **API** in the left sidebar
2. Scroll to **Spaces access keys**
3. Click **Generate New Key**
4. Give it a name (e.g., "RepairCoin Backend")
5. Copy both the **Access Key** and **Secret Key** immediately
   - ⚠️ Secret key is only shown once!

### 3. Configure Environment Variables

Add these variables to your `.env` file:

```env
# DigitalOcean Spaces Configuration
DO_SPACES_KEY=your_access_key_here
DO_SPACES_SECRET=your_secret_key_here
DO_SPACES_BUCKET=repaircoin-images
DO_SPACES_REGION=nyc3
DO_SPACES_CDN_ENDPOINT=https://repaircoin-images.nyc3.cdn.digitaloceanspaces.com
```

**Environment Variables Explained**:

- `DO_SPACES_KEY`: Your Spaces access key (from step 2)
- `DO_SPACES_SECRET`: Your Spaces secret key (from step 2)
- `DO_SPACES_BUCKET`: Your Space name (from step 1)
- `DO_SPACES_REGION`: Datacenter region where Space was created (e.g., `nyc3`)
- `DO_SPACES_CDN_ENDPOINT`: CDN URL for your Space (if CDN enabled)
  - Format: `https://{bucket}.{region}.cdn.digitaloceanspaces.com`
  - If CDN not enabled, leave empty (will use direct Spaces URL)

### 4. Verify Configuration

Start your backend server and check the logs:

```bash
cd backend
npm run dev
```

You should see:
```
ImageStorageService initialized { bucket: 'repaircoin-images', region: 'nyc3' }
```

### 5. Test Image Upload

You can test the upload functionality using curl:

```bash
# Replace YOUR_TOKEN with a valid shop JWT token
curl -X POST http://localhost:4000/api/upload/shop-logo \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "image=@/path/to/your/image.jpg"
```

Successful response:
```json
{
  "success": true,
  "url": "https://repaircoin-images.nyc3.cdn.digitaloceanspaces.com/shops/shop-123/logos/1234567890-abc123def456-logo.jpg",
  "key": "shops/shop-123/logos/1234567890-abc123def456-logo.jpg"
}
```

## API Endpoints

The following endpoints are available for image management:

### Upload Shop Logo
```
POST /api/upload/shop-logo
Authorization: Bearer <shop_token>
Content-Type: multipart/form-data

Body: FormData with 'image' field
```

### Upload Service Image
```
POST /api/upload/service-image
Authorization: Bearer <shop_token>
Content-Type: multipart/form-data

Body: FormData with 'image' field
```

### Upload Shop Banner
```
POST /api/upload/shop-banner
Authorization: Bearer <shop_token>
Content-Type: multipart/form-data

Body: FormData with 'image' field
```

### Delete Image
```
DELETE /api/upload/:key
Authorization: Bearer <shop_token>

Example: DELETE /api/upload/shops/shop-123/logos/image.jpg
```

### Get Presigned URL (for private images)
```
GET /api/upload/presigned/:key?expiresIn=3600
Authorization: Bearer <token>

Example: GET /api/upload/presigned/shops/shop-123/logos/image.jpg
```

## File Organization

Images are automatically organized in folders:

```
spaces-bucket/
├── shops/
│   ├── shop-123/
│   │   ├── logos/
│   │   │   └── 1234567890-abc123-logo.jpg
│   │   ├── services/
│   │   │   ├── 1234567890-def456-service1.jpg
│   │   │   └── 1234567890-ghi789-service2.jpg
│   │   └── banners/
│   │       └── 1234567890-jkl012-banner.jpg
│   └── shop-456/
│       └── ...
```

## Image Constraints

- **Allowed formats**: JPEG, PNG, GIF, WebP
- **Max file size**: 5MB
- **Recommended sizes**:
  - Shop logos: 200x200px (square)
  - Service images: 800x600px
  - Shop banners: 1200x400px

## CDN Benefits

When CDN is enabled:
- Images are cached at edge locations worldwide
- Faster load times for users
- Reduced bandwidth costs
- Cache headers set to 1 year for optimal performance

## Security

- All uploads require authentication (shop JWT token)
- Shops can only delete their own images
- Public-read ACL allows anyone to view images (necessary for website display)
- Keys include shop ID for access control

## Pricing

DigitalOcean Spaces pricing (as of 2024):
- **$5/month** includes:
  - 250GB storage
  - 1TB outbound transfer
- **Additional costs**:
  - $0.02/GB for additional storage
  - $0.01/GB for additional transfer

For a typical shop with 100 service images (~50MB), costs remain at base $5/month.

## Troubleshooting

### Error: "DO_SPACES_BUCKET environment variable is required"
- Make sure `.env` file exists in backend directory
- Verify `DO_SPACES_BUCKET` is set correctly

### Error: "Invalid file type"
- Only JPEG, PNG, GIF, and WebP are supported
- Check file MIME type

### Error: "File size exceeds 5MB limit"
- Compress image before uploading
- Use image optimization tools

### Error: "Failed to upload image"
- Check API keys are correct
- Verify Space name matches `DO_SPACES_BUCKET`
- Check Space region matches `DO_SPACES_REGION`

### Images not loading in browser
- Verify CDN endpoint URL is correct
- Check Space file listing is set to "Public" or files have public-read ACL
- Test direct URL in browser

## Migration from Other Storage

If migrating from another storage provider:

1. Keep old storage active during migration
2. Update environment variables for DigitalOcean Spaces
3. New uploads will go to Spaces automatically
4. Optionally migrate old images using bulk transfer tools
5. Update database records with new URLs once migration complete

## Additional Resources

- [DigitalOcean Spaces Documentation](https://docs.digitalocean.com/products/spaces/)
- [AWS SDK for JavaScript v3 (used by this service)](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)
- [S3-Compatible API Reference](https://docs.digitalocean.com/reference/api/spaces-api/)
