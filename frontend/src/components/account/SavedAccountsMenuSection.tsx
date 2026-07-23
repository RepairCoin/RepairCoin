"use client";

import React, { useEffect, useState } from "react";
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { getDeviceSessions } from "@/services/api/auth";
import { getSavedAccounts, type SavedAccount } from "@/utils/savedAccounts";

/**
 * "Switch to" list inside the account dropdown — the other accounts this device is
 * still signed into. It's populated from the SERVER (GET /auth/sessions), so every
 * account shown can be switched to instantly (no re-verification). If the server
 * can't be reached we fall back to the locally-remembered list, whose entries route
 * through a normal sign-in instead.
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
    let active = true;
    // Server truth first: accounts this device holds a live session for.
    getDeviceSessions()
      .then((sessions) => {
        if (!active) return;
        if (sessions.length > 0) {
          setAccounts(
            sessions.map((s) => ({
              address: s.address,
              name: s.name,
              role: s.role,
              avatarUrl: s.avatarUrl,
              lastUsedAt: s.lastUsedAt ? Date.parse(s.lastUsedAt) : 0,
            }))
          );
        } else {
          // Offline / no server sessions — fall back to the local remembered list.
          setAccounts(getSavedAccounts());
        }
      })
      .catch(() => active && setAccounts(getSavedAccounts()));
    return () => {
      active = false;
    };
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
        </DropdownMenuItem>
      ))}
    </>
  );
};

export default SavedAccountsMenuSection;
