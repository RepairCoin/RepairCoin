"use client";

import React, { useEffect, useState } from "react";
import { Heart, Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";
import { getFollowStatus, followShop, unfollowShop } from "@/services/api/shop";

interface FollowShopButtonProps {
  shopId: string;
  shopName?: string;
  /** "icon" = compact heart (cards); "full" = labeled button (profile). */
  variant?: "icon" | "full";
  className?: string;
  /**
   * Fired after a confirmed follow/unfollow (not on the optimistic flip, and not
   * on a reverted failure). Lets a parent keep a follower count in sync.
   */
  onChange?: (following: boolean) => void;
}

/**
 * Follow / unfollow a shop. Following a shop gets the customer notified when it
 * publishes a new service (see backend shop_new_service notification).
 */
export const FollowShopButton: React.FC<FollowShopButtonProps> = ({
  shopId,
  shopName,
  variant = "icon",
  className = "",
  onChange,
}) => {
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    getFollowStatus(shopId)
      .then((f) => active && setFollowing(f))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [shopId]);

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    const next = !following;
    setFollowing(next); // optimistic
    const ok = next ? await followShop(shopId) : await unfollowShop(shopId);
    if (!ok) {
      setFollowing(!next); // revert
      toast.error("Couldn't update follow. Try again.");
    } else {
      toast.success(next ? `Following ${shopName || "shop"} — we'll alert you to new services` : "Unfollowed");
      onChange?.(next);
    }
    setBusy(false);
  };

  if (variant === "full") {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={loading || busy}
        aria-pressed={following}
        className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60 ${
          following
            ? "bg-red-500 text-white hover:bg-red-600"
            : "border border-gray-700 bg-[#1A1A1A] text-gray-200 hover:border-red-500/50 hover:text-red-400"
        } ${className}`}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Heart className={`h-4 w-4 ${following ? "fill-current" : ""}`} />
        )}
        {following ? "Following" : "Follow"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading || busy}
      aria-label={following ? "Unfollow shop" : "Follow shop"}
      title={following ? "Following — click to unfollow" : "Follow for new-service alerts"}
      className={`flex h-9 w-9 items-center justify-center rounded-full backdrop-blur-sm transition-colors disabled:opacity-60 ${
        following
          ? "bg-red-500/90 text-white"
          : "bg-black/40 text-white hover:bg-black/60"
      } ${className}`}
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Heart className={`h-4 w-4 ${following ? "fill-current" : ""}`} />
      )}
    </button>
  );
};

export default FollowShopButton;
