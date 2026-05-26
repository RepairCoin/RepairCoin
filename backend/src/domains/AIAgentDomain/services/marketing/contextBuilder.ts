// backend/src/domains/AIAgentDomain/services/marketing/contextBuilder.ts
//
// Fetches per-request shop context for the marketing prompt:
//   - Shop name (for tone + signatures in drafted bodies)
//   - Up to 10 active services (for new-service announcements and
//     generic CTAs)
//   - Up to 3 most-recent campaign subjects (for tone matching and
//     duplicate avoidance)
//
// Cheap queries — runs once per request before the Claude call. The
// resulting context block is concatenated with the static rules block
// and marked cache_control: ephemeral so per-shop cache hits across
// turns in the same session.

import { logger } from "../../../../utils/logger";
import { ShopRepository } from "../../../../repositories/ShopRepository";
import { ServiceRepository } from "../../../../repositories/ServiceRepository";
import { MarketingCampaignRepository } from "../../../../repositories/MarketingCampaignRepository";
import { MarketingShopContext } from "./promptBuilder";

const MAX_SERVICES = 10;
const MAX_RECENT_CAMPAIGNS = 3;

export async function buildMarketingShopContext(
  shopId: string
): Promise<MarketingShopContext> {
  const shopRepo = new ShopRepository();
  const serviceRepo = new ServiceRepository();
  const campaignRepo = new MarketingCampaignRepository();

  let shopName = "the shop";
  let services: MarketingShopContext["services"] = [];
  let recentCampaignSubjects: string[] = [];

  try {
    const shop = await shopRepo.getShop(shopId);
    if (shop?.name && shop.name.trim()) {
      shopName = shop.name.trim();
    }
  } catch (err) {
    logger.warn("marketing contextBuilder: getShop failed", {
      shopId,
      error: (err as Error)?.message,
    });
  }

  try {
    const result = await serviceRepo.getServicesByShop(shopId, {
      page: 1,
      limit: MAX_SERVICES,
      activeOnly: true,
    });
    services = result.items.slice(0, MAX_SERVICES).map((s: any) => ({
      id: s.serviceId ?? s.id ?? "",
      name: s.serviceName ?? s.name ?? "(unnamed service)",
      priceUsd: typeof s.priceUsd === "number" ? s.priceUsd : null,
    }));
  } catch (err) {
    logger.warn("marketing contextBuilder: getServicesByShop failed", {
      shopId,
      error: (err as Error)?.message,
    });
  }

  try {
    const result = await campaignRepo.findByShop(
      shopId,
      { page: 1, limit: MAX_RECENT_CAMPAIGNS },
      "sent"
    );
    recentCampaignSubjects = result.items
      .map((c) => c.subject || "")
      .filter((s) => s.trim().length > 0)
      .slice(0, MAX_RECENT_CAMPAIGNS);
  } catch (err) {
    logger.warn("marketing contextBuilder: findByShop campaigns failed", {
      shopId,
      error: (err as Error)?.message,
    });
  }

  return {
    shopName,
    services,
    recentCampaignSubjects,
  };
}
