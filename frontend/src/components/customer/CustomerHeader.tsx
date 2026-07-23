"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useActiveWallet, useDisconnect } from "thirdweb/react";
import { Settings, HelpCircle, LogOut, RefreshCw, ChevronDown } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useCustomerStore } from "@/stores/customerStore";
import { performSwitchAccount } from "@/utils/switchAccount";
import { rememberAccount, type SavedAccount } from "@/utils/savedAccounts";
import { SavedAccountsMenuSection } from "@/components/account/SavedAccountsMenuSection";
import { MessageIcon } from "@/components/messaging/MessageIcon";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { CustomerBreadcrumb } from "./CustomerBreadcrumb";
import { HeaderSearch } from "./HeaderSearch";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface CustomerHeaderProps {
  activeTab: string;
  description?: string;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

export function CustomerHeader({ activeTab, description }: CustomerHeaderProps) {
  const name = useAuthStore((s) => s.userProfile?.name);
  const avatarUrl = useAuthStore((s) => s.userProfile?.avatarUrl);
  const walletAddress = useAuthStore((s) => s.userProfile?.address);
  const profileEmail = useAuthStore((s) => s.userProfile?.email);
  const tier = useCustomerStore((s) => s.customerData?.tier);
  const resetAuth = useAuthStore((s) => s.resetAuth);
  const [avatarError, setAvatarError] = useState(false);

  const firstName = (name || "there").split(" ")[0];
  const displayName = name || "there";
  const showAvatar = avatarUrl && !avatarError;

  const router = useRouter();
  const wallet = useActiveWallet();
  const { disconnect } = useDisconnect();

  const handleSwitchAccount = useCallback(
    (targetAccount?: SavedAccount) =>
      performSwitchAccount({ wallet, disconnect, resetAuth, targetAccount }),
    [resetAuth, wallet, disconnect]
  );

  // Remember this account so it appears in the "Switch to" list next time.
  useEffect(() => {
    if (!walletAddress) return;
    rememberAccount({
      address: walletAddress,
      name: name || undefined,
      email: profileEmail || undefined,
      avatarUrl: avatarUrl || undefined,
      role: "customer",
    });
  }, [walletAddress, name, profileEmail, avatarUrl]);

  return (
    <div className="pt-2">
      <div className="flex items-center gap-6">
        <HeaderSearch activeTab={activeTab} />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Open account menu"
              className="hidden items-center gap-2.5 rounded-xl px-2 py-1 transition-colors hover:bg-[#262626] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FFCC00]/50 data-[state=open]:bg-[#262626] lg:flex"
            >
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
              <div className="leading-tight text-left">
                <p className="text-sm font-semibold text-white">Hi, {displayName}</p>
                {tier && <p className="text-xs font-medium text-[#FFCC00]">{capitalize(tier)} Tier</p>}
              </div>
              <ChevronDown className="h-4 w-4 text-gray-400" />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="start"
            className="w-56 border border-[#262626] bg-[#1A1A1A] text-white"
          >
            <DropdownMenuLabel className="font-normal">
              <p className="text-sm font-medium text-white">Hi, {displayName}</p>
              {tier && (
                <p className="text-xs text-[#FFCC00]">{capitalize(tier)} Tier</p>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-[#262626]" />

            <DropdownMenuItem
              onSelect={() => router.push("/customer?tab=settings")}
              className="cursor-pointer focus:bg-[#262626] focus:text-white"
            >
              <Settings className="h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => router.push("/customer?tab=faq")}
              className="cursor-pointer focus:bg-[#262626] focus:text-white"
            >
              <HelpCircle className="h-4 w-4" />
              FAQ &amp; Help
            </DropdownMenuItem>

            <SavedAccountsMenuSection
              currentAddress={walletAddress}
              onSelect={(account) => handleSwitchAccount(account)}
            />

            <DropdownMenuSeparator className="bg-[#262626]" />

            <DropdownMenuItem
              onSelect={() => handleSwitchAccount()}
              className="cursor-pointer focus:bg-[#262626] focus:text-white"
            >
              <RefreshCw className="h-4 w-4" />
              Add another account
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => handleSwitchAccount()}
              className="cursor-pointer text-red-400 focus:bg-red-500/10 focus:text-red-300"
            >
              <LogOut className="h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

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
