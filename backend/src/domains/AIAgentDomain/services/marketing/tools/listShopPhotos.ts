// backend/src/domains/AIAgentDomain/services/marketing/tools/listShopPhotos.ts
//
// Tool: list_shop_photos (AI Image Generation Phase 8 — storefront / shop-photo
// reuse, scope §3.4-A)
//
// Read-only. Returns the photos the shop has ALREADY uploaded — no new upload
// needed — so the assistant can use them as a campaign banner or as an edit/
// vision source. Three sources, in priority order:
//   - shops.banner_url      → labeled "storefront" (the 1200×300 shop banner is,
//                             in practice, the shop's storefront/hero image)
//   - shop_gallery_photos   → labeled "gallery" (+ caption)
//   - shop_services.image_url (active services only) → labeled "service"
//
// The key disambiguation the assistant needs: "your storefront photo" resolves
// to the single `storefront` entry (banner_url). That URL is a /shops/{shopId}/
// path, so passing it to propose_campaign_draft's `image_url` embeds it directly
// (resolveBannerImage recognizes the shop-owned prefix), and propose_image_edit
// accepts it as a source. shopId comes from the JWT only — never from args.

import {
  MarketingTool,
  MarketingToolContext,
  MarketingToolResult,
} from "../types";

const NAME = "list_shop_photos";

interface ShopPhoto {
  url: string;
  /** storefront = the shop banner (the default "your storefront photo"). */
  type: "storefront" | "gallery" | "service";
  caption: string | null;
}

export const listShopPhotos: MarketingTool = {
  name: NAME,
  description:
    "List the photos this shop has ALREADY uploaded so you can reuse one as a " +
    "campaign banner or as an image to edit — no new upload needed. Returns " +
    "the shop's STOREFRONT photo (the shop banner), gallery photos, and " +
    "service photos, each with a url, type, and caption. Call this when the " +
    "owner refers to 'our storefront', 'our shop photo', 'the photo of our " +
    "store', or wants to use 'a photo we already have' — then pass the chosen " +
    "url to propose_campaign_draft (image_url) to put it at the top of the " +
    "email, or to propose_image_edit to modify it. 'Your storefront photo' = " +
    "the single entry with type 'storefront'. Read-only — never mutates.",
  inputSchema: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },
  async execute(
    _args: unknown,
    ctx: MarketingToolContext
  ): Promise<MarketingToolResult> {
    const photos: ShopPhoto[] = [];

    // Storefront (shop banner) — the headline "your storefront photo".
    const storefront = await ctx.pool.query<{ banner_url: string | null }>(
      `SELECT banner_url FROM shops WHERE shop_id = $1`,
      [ctx.shopId]
    );
    const bannerUrl = storefront.rows[0]?.banner_url;
    if (bannerUrl) {
      photos.push({ url: bannerUrl, type: "storefront", caption: "Shop storefront banner" });
    }

    // Gallery photos (up to 20, ordered as the shop arranged them).
    const gallery = await ctx.pool.query<{ photo_url: string; caption: string | null }>(
      `SELECT photo_url, caption
         FROM shop_gallery_photos
        WHERE shop_id = $1 AND photo_url IS NOT NULL
        ORDER BY display_order ASC, id ASC
        LIMIT 20`,
      [ctx.shopId]
    );
    for (const row of gallery.rows) {
      photos.push({ url: row.photo_url, type: "gallery", caption: row.caption ?? null });
    }

    // Active service photos.
    const services = await ctx.pool.query<{ image_url: string; service_name: string }>(
      `SELECT image_url, service_name
         FROM shop_services
        WHERE shop_id = $1 AND active = true AND image_url IS NOT NULL
        ORDER BY created_at DESC
        LIMIT 20`,
      [ctx.shopId]
    );
    for (const row of services.rows) {
      photos.push({ url: row.image_url, type: "service", caption: row.service_name });
    }

    return {
      data: {
        photos,
        has_storefront: Boolean(bannerUrl),
        count: photos.length,
      },
    };
  },
};
