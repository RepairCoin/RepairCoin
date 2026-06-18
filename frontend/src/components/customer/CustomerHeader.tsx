"use client";

import React, { useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useCustomerStore } from "@/stores/customerStore";
import { MessageIcon } from "@/components/messaging/MessageIcon";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { CustomerBreadcrumb } from "./CustomerBreadcrumb";
import { HeaderSearch } from "./HeaderSearch";

interface CustomerHeaderProps {
  activeTab: string;
  description?: string;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

export function CustomerHeader({ activeTab, description }: CustomerHeaderProps) {
  const name = useAuthStore((s) => s.userProfile?.name);
  const avatarUrl = useAuthStore((s) => s.userProfile?.avatarUrl);
  const tier = useCustomerStore((s) => s.customerData?.tier);
  const [avatarError, setAvatarError] = useState(false);

  const firstName = (name || "there").split(" ")[0];
  const displayName = name || "there";
  const showAvatar = avatarUrl && !avatarError;

  return (
    <div className="pt-2">
      <div className="flex items-center gap-6">
        <HeaderSearch activeTab={activeTab} />

        <div className="hidden items-center gap-2.5 lg:flex">
          {showAvatar ? (
            <img
              src={avatarUrl}
              alt={firstName}
              onError={() => setAvatarError(true)}
              className="h-10 w-10 rounded-xl object-cover"
            />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFCC00] text-sm font-bold text-[#101010]">
              {firstName.charAt(0).toUpperCase()}
            </span>
          )}
          <div className="leading-tight">
            <p className="text-sm font-semibold text-white">Hi, {displayName}</p>
            {tier && <p className="text-xs font-medium text-[#FFCC00]">{capitalize(tier)} Tier</p>}
          </div>
        </div>

        <div className="ml-auto hidden items-center gap-3 lg:flex [&_button]:!p-2.5 [&_svg]:!h-[22px] [&_svg]:!w-[22px]">
          <MessageIcon />
          <NotificationBell />
        </div>
      </div>

      <div className="mt-4">
        <CustomerBreadcrumb activeTab={activeTab} description={description} />
      </div>
    </div>
  );
}

export default CustomerHeader;
