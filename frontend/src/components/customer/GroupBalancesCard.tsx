"use client";

import { useState, useEffect } from "react";
import { useActiveAccount } from "thirdweb/react";
import { Coins, TrendingUp, ChevronRight } from "lucide-react";
import * as shopGroupsAPI from "@/services/api/shopGroups";

export default function GroupBalancesCard() {
  const account = useActiveAccount();
  const [balances, setBalances] = useState<shopGroupsAPI.CustomerGroupBalance[]>([]);
  const [groups, setGroups] = useState<Map<string, shopGroupsAPI.ShopGroup>>(new Map());
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (account?.address) {
      loadBalances();
    }
  }, [account?.address]);

  const loadBalances = async () => {
    if (!account?.address) return;

    try {
      setLoading(true);
      const balancesData = await shopGroupsAPI.getAllCustomerBalances(account.address);

      // Load group details for each balance
      const groupsMap = new Map<string, shopGroupsAPI.ShopGroup>();
      await Promise.all(
        balancesData.map(async (balance) => {
          if (!groupsMap.has(balance.groupId)) {
            const group = await shopGroupsAPI.getGroup(balance.groupId);
            if (group) {
              groupsMap.set(balance.groupId, group);
            }
          }
        })
      );

      setBalances(balancesData);
      setGroups(groupsMap);
    } catch (error) {
      console.error("Error loading group balances:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Coins className="w-5 h-5 text-[#FFCC00]" />
            Shop Group Tokens
          </h3>
        </div>
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#FFCC00] mx-auto"></div>
        </div>
      </div>
    );
  }

  if (balances.length === 0) {
    return null; // Don't show card if no balances
  }

  const displayBalances = expanded ? balances : balances.slice(0, 3);

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Coins className="w-5 h-5 text-[#FFCC00]" />
          Shop Group Tokens
        </h3>
        <span className="text-sm text-gray-400">{balances.length} Groups</span>
      </div>

      <div className="space-y-3">
        {displayBalances.map((balance) => {
          const group = groups.get(balance.groupId);
          if (!group) return null;

          return (
            <div
              key={balance.groupId}
              className="bg-gray-900 rounded-lg p-4 hover:bg-gray-850 transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-bold text-white">{group.groupName}</p>
                    <span className="px-2 py-0.5 bg-[#FFCC00]/20 text-[#FFCC00] text-xs rounded-full font-medium">
                      {group.customTokenSymbol}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">Balance: </span>
                      <span className="text-white font-medium">
                        {balance.balance} {group.customTokenSymbol}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">Earned: </span>
                      <span className="text-green-500 font-medium">
                        {balance.lifetimeEarned}
                      </span>
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-500" />
              </div>
            </div>
          );
        })}
      </div>

      {balances.length > 3 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full mt-3 py-2 text-sm text-[#FFCC00] hover:text-[#FFD700] transition-colors font-medium"
        >
          {expanded ? "Show Less" : `Show ${balances.length - 3} More`}
        </button>
      )}

      <div className="mt-4 pt-4 border-t border-gray-700">
        <p className="text-xs text-gray-400">
          These tokens are specific to shop groups and can be redeemed at participating member
          shops.
        </p>
      </div>
    </div>
  );
}
