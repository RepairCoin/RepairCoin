import { useCallback } from "react";
import { router } from "expo-router";
import { AdPlacement } from "@/feature/services/services/service.interface";
import {
  useAdPlacementsQuery,
  useRecordAdClickMutation,
  DEFAULT_AD_PLACEMENT,
} from "./useFeatureTabQuery";

/**
 * Sponsored cards for one in-app surface, plus the tap handler.
 *
 * Shared by every screen that renders an ad placement so the click-logging and
 * navigation rules live in exactly one place. `placement` identifies the surface and is
 * what the backend records against the click, keeping per-surface analytics separable.
 *
 * Ads are always additive — callers must render normally when `ads` is empty or the query
 * failed, and must never gate their loading state on this hook.
 */
export function useAdPlacements(placement: string = DEFAULT_AD_PLACEMENT) {
  const { data: ads, refetch } = useAdPlacementsQuery(placement);
  const { mutate: recordAdClick } = useRecordAdClickMutation();

  const handleAdPress = useCallback(
    (ad: AdPlacement) => {
      // Fire-and-forget: navigation must never wait on analytics.
      recordAdClick({ campaignId: ad.campaignId, placement });
      // Every tap lands on the campaign's landing page — the same destination a Meta/Google ad
      // click gets on the web (/l/:campaignId). The card's `target` is NOT used for navigation:
      // the landing page carries the full offer + lead form, and its promoted-service tiles are
      // the in-app route to the service that `target` used to point at.
      router.push(`/customer/ads/${ad.campaignId}` as any);
    },
    [recordAdClick, placement],
  );

  return { ads, refetchAds: refetch, handleAdPress };
}
