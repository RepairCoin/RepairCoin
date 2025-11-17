"use client";

import { useState, useEffect } from "react";
import { useActiveAccount } from "thirdweb/react";
import { Coins, TrendingUp, ChevronRight } from "lucide-react";
import * as shopGroupsAPI from "../../services/api/affiliateShopGroups";

export default function GroupBalancesCard() {
  const account = useActiveAccount();
  const [balances, setBalances] = useState<shopGroupsAPI.CustomerAffiliateGroupBalance[]>([]);
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
      <div className="bg-[#212121] rounded-xl sm:rounded-2xl lg:rounded-3xl mb-6 sm:mb-8">
        <div
          className="w-full px-4 sm:px-6 lg:px-8 py-3 sm:py-4 text-white rounded-t-xl sm:rounded-t-2xl lg:rounded-t-3xl"
          style={{
            backgroundImage: `url('/img/cust-ref-widget3.png')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        >
          <p className="text-lg md:text-xl text-gray-900 font-semibold flex items-center gap-2">
            <Coins className="w-5 h-5" />
            Shop Group Tokens
          </p>
        </div>
        <div className="bg-[#212121] p-4 text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FFCC00] mx-auto"></div>
        </div>
      </div>
    );
  }

  if (balances.length === 0) {
    return null; // Don't show card if no balances
  }

  const displayBalances = expanded ? balances : balances.slice(0, 3);

  return (
    <div className="bg-[#212121] rounded-xl sm:rounded-2xl lg:rounded-3xl mb-6 sm:mb-8">
      <div
        className="w-full px-4 sm:px-6 lg:px-8 py-3 sm:py-4 text-white rounded-t-xl sm:rounded-t-2xl lg:rounded-t-3xl flex justify-between items-center"
        style={{
          backgroundImage: `url('/img/cust-ref-widget3.png')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <p className="text-lg md:text-xl text-gray-900 font-semibold flex items-center gap-2">
          <Coins className="w-5 h-5" />
          Shop Group Tokens
        </p>
        <span className="text-sm text-gray-600 font-medium">{balances.length} Groups</span>
      </div>

      <div className="bg-[#212121] p-4 sm:p-6">
        <div className="space-y-3">
          {displayBalances.map((balance) => {
            const group = groups.get(balance.groupId);
            if (!group) return null;

            return (
              <div
                key={balance.groupId}
                className="bg-[#2F2F2F] rounded-lg p-4 hover:bg-[#363636] transition-colors border border-gray-800"
              >
                <div className="flex items-center justify-between gap-3">
                  {/* Group Icon */}
                  <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-[#FFCC00]/20 to-[#FFCC00]/10 rounded-xl flex items-center justify-center border border-[#FFCC00]/30">
                    <span className="text-2xl">{group.icon || "🏪"}</span>
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="font-bold text-white">{group.groupName}</p>
                      <span className="px-2 py-0.5 bg-[#FFCC00]/20 text-[#FFCC00] text-xs rounded-full font-medium border border-[#FFCC00]/30">
                        {group.customTokenSymbol}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-gray-400">Balance: </span>
                        <span className="text-white font-bold">
                          {balance.balance.toLocaleString()} <span className="text-[#FFCC00]">{group.customTokenSymbol}</span>
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400">Earned: </span>
                        <span className="text-green-400 font-bold">
                          {balance.lifetimeEarned.toLocaleString()} <span className="text-green-300">{group.customTokenSymbol}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-600" />
                </div>
              </div>
            );
          })}
        </div>

        {balances.length > 3 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full mt-4 py-2 text-sm text-[#FFCC00] hover:text-[#FFD700] transition-colors font-medium"
          >
            {expanded ? "Show Less" : `Show ${balances.length - 3} More`}
          </button>
        )}

        <div className="mt-4 pt-4 border-t border-gray-800">
          <p className="text-xs text-gray-400">
            These tokens are specific to shop groups and can be redeemed at participating member shops.
          </p>
        </div>
      </div>
    </div>
  );
}
