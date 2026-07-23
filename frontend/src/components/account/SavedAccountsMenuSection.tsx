"use client";

import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { getSavedAccounts, forgetAccount, type SavedAccount } from "@/utils/savedAccounts";

/**
 * "Switch to" list inside the account dropdown — the other accounts you've used on
 * this device (remembered locally, so they persist across logout). Selecting one
 * takes you to the sign-in screen for that account (greeted, email pre-filled via
 * the saved-profiles login) — a quick re-login rather than an instant switch.
 */

interface SavedAccountsMenuSectionProps {
  /** Current account address — excluded from the list. */
  currentAddress?: string;
  onSelect: (account: SavedAccount) => void;
}

const shorten = (addr: string) =>
  addr.length > 10 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;

export const SavedAccountsMenuSection: React.FC<SavedAccountsMenuSectionProps> = ({
  currentAddress,
  onSelect,
}) => {
  const [accounts, setAccounts] = useState<SavedAccount[]>([]);

  useEffect(() => {
    setAccounts(getSavedAccounts());
  }, []);

  const others = accounts.filter(
    (a) => a.address.toLowerCase() !== currentAddress?.toLowerCase()
  );

  if (others.length === 0) return null;

  return (
    <>
      <DropdownMenuSeparator className="bg-[#262626]" />
      <DropdownMenuLabel className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
        Switch to
      </DropdownMenuLabel>

      {others.map((account) => (
        <DropdownMenuItem
          key={account.address}
          onSelect={() => onSelect(account)}
          className="cursor-pointer gap-2 focus:bg-[#262626] focus:text-white"
        >
          {account.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={account.avatarUrl}
              alt=""
              className="h-6 w-6 shrink-0 rounded-lg object-cover"
            />
          ) : (
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#FFCC00] text-[11px] font-bold text-[#101010]">
              {(account.name || account.address).charAt(0).toUpperCase()}
            </span>
          )}

          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm text-white">
              {account.name || shorten(account.address)}
            </span>
            <span className="block truncate text-[11px] text-gray-500">
              {account.email || shorten(account.address)}
              {account.role ? ` · ${account.role}` : ""}
            </span>
          </span>

          <span
            role="button"
            tabIndex={-1}
            aria-label="Remove from list"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setAccounts(forgetAccount(account.address));
            }}
            className="shrink-0 rounded p-1 text-gray-500 transition-colors hover:bg-[#333] hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </span>
        </DropdownMenuItem>
      ))}
    </>
  );
};

export default SavedAccountsMenuSection;
