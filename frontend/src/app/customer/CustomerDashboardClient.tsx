"use client";

import { useState, useEffect } from "react";
import { ConnectButton, useReadContract } from "thirdweb/react";
import { getContract, createThirdwebClient } from "thirdweb";
import { baseSepolia } from "thirdweb/chains";
import { useAuth } from "../../hooks/useAuth";
import { useRouter } from "next/navigation";
import { SimpleUnsuspendModal } from "../../components/SimpleUnsuspendModal";
import { ReferralDashboard } from "../../components/customer/ReferralDashboard";
import { RedemptionApprovals } from "../../components/customer/RedemptionApprovals";
import { OverviewTab } from "../../components/customer/OverviewTab";
import { TransactionsTab } from "../../components/customer/TransactionsTab";
import { SettingsTab } from "../../components/customer/SettingsTab";
import { Toaster } from "react-hot-toast";
import DashboardLayout from "@/components/ui/DashboardLayout";

const client = createThirdwebClient({
  clientId:
    process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID ||
    "1969ac335e07ba13ad0f8d1a1de4f6ab",
});

const contract = getContract({
  client,
  chain: baseSepolia,
  address: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!,
});

interface CustomerData {
  address: string;
  email: string;
  name?: string;
  phone?: string;
  referralCode?: string;
  tier: "BRONZE" | "SILVER" | "GOLD";
  lifetimeEarnings: number;
  currentBalance: number;
  totalRedemptions: number;
  dailyEarnings: number;
  monthlyEarnings: number;
  isActive: boolean;
  suspensionReason?: string;
  lastEarnedDate?: string;
  joinDate: string;
  notificationsEnabled?: boolean;
  twoFactorEnabled?: boolean;
}

interface EarnedBalanceData {
  earnedBalance: number;
  marketBalance: number;
  totalBalance: number;
}

interface TransactionHistory {
  id: string;
  type: "earned" | "redeemed" | "bonus" | "referral";
  amount: number;
  shopId?: string;
  shopName?: string;
  description: string;
  createdAt: string;
}

export default function CustomerRegisterClient() {
  const router = useRouter();
  const { account, userProfile, isLoading, isAuthenticated } = useAuth();
  const [customerData, setCustomerData] = useState<CustomerData | null>(null);
  const [blockchainBalance, setBlockchainBalance] = useState<number>(0);
  const [earnedBalanceData, setEarnedBalanceData] =
    useState<EarnedBalanceData | null>(null);
  const [transactions, setTransactions] = useState<TransactionHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUnsuspendModal, setShowUnsuspendModal] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "overview" | "transactions" | "referrals" | "approvals" | "settings"
  >("overview");

  // Read token balance from contract
  const { data: tokenBalance, isLoading: balanceLoading } = useReadContract({
    contract,
    method: "function balanceOf(address) view returns (uint256)",
    params: account?.address ? [account.address] : [""],
  });

  const fetchCustomerData = async () => {
    if (!account?.address) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch customer data
      const customerResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/customers/${account.address}`
      );
      if (customerResponse.ok) {
        const customerResult = await customerResponse.json();
        console.log("Customer data from API:", customerResult.data);
        // Extract the customer object from the response
        const customerData =
          customerResult.data.customer || customerResult.data;
        setCustomerData(customerData);
        // Store blockchain balance separately
        if (customerResult.data.blockchainBalance !== undefined) {
          setBlockchainBalance(customerResult.data.blockchainBalance);
        }
      } else if (customerResponse.status === 404) {
        setError('Address not associated with a customer account.');
      }

      // Authenticate customer to get JWT token
      try {
        const authResponse = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/auth/customer`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ address: account.address }),
          }
        );

        if (authResponse.ok) {
          const authResult = await authResponse.json();
          // Store token for future requests
          localStorage.setItem("customerAuthToken", authResult.token);
          sessionStorage.setItem("customerAuthToken", authResult.token);
          console.log("Customer authenticated successfully");
        } else {
          console.log("Customer auth failed:", authResponse.status);
        }
      } catch (authError) {
        console.log("Customer authentication error:", authError);
      }

      // Fetch earned balance data
      const balanceResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/tokens/earned-balance/${account.address}`
      );
      if (balanceResponse.ok) {
        const balanceResult = await balanceResponse.json();
        setEarnedBalanceData(balanceResult.data);
      }

      // Fetch recent transactions
      const customerToken = localStorage.getItem("customerAuthToken");
      const transactionsResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/customers/${account.address}/transactions?limit=10`,
        {
          headers: {
            ...(customerToken
              ? { Authorization: `Bearer ${customerToken}` }
              : {}),
          },
        }
      );
      if (transactionsResponse.ok) {
        const transactionsResult = await transactionsResponse.json();
        setTransactions(transactionsResult.data?.transactions || []);
      }
    } catch (err) {
      console.log("Error fetching customer data:", err);
      setError("Failed to load customer data");
    } finally {
      setLoading(false);
    }
  };

  const formatBalance = (balance: bigint | undefined): string => {
    if (!balance) return "0";
    return (Number(balance) / 1e18).toFixed(2);
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab as any);
  };

  // Fetch customer data
  useEffect(() => {
    if (account?.address) {
      fetchCustomerData();
    }
  }, [account?.address]);

  // Update blockchain balance when contract read completes
  useEffect(() => {
    if (tokenBalance && !balanceLoading) {
      const formattedBalance = parseFloat(formatBalance(tokenBalance));
      setBlockchainBalance(formattedBalance);
    }
  }, [tokenBalance, balanceLoading]);

  // Error state (shop not found)
  if (error && !customerData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0D0D0D] py-32">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="text-center">
            <div className="text-red-500 text-4xl mb-4">🚫</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              Customer Not Found
            </h3>
            <p className="text-gray-600 mb-6">{error}</p>
            <a 
              href="/customer/register"
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-3 px-4 rounded-xl transition duration-200 transform hover:scale-105 inline-block"
            >
              Register Customer
            </a>
            <div className="mt-6 pt-6 border-t border-gray-200">
              <ConnectButton
                client={client}
                theme="light"
                connectModal={{ size: "compact" }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Not connected state
  if (!account) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0D0D0D] py-32">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="text-center">
            <div className="text-6xl mb-6">🏪</div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Customer Dashboard
            </h1>
            <p className="text-gray-600 mb-8">
              Connect your shop wallet to access the dashboard
            </p>
            <ConnectButton
              client={client}
              theme="light"
              connectModal={{ size: "wide" }}
            />
          </div>
        </div>
      </div>
    );
  }

  // Check if customer is suspended
  if (customerData && !customerData.isActive) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-pink-100">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100 text-center">
            <div className="text-6xl mb-6">🚫</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Account Suspended
            </h1>
            <p className="text-gray-600 mb-6">
              Your account has been suspended. You cannot perform any token
              transactions while suspended.
            </p>
            {customerData.suspensionReason && (
              <div className="bg-red-50 rounded-lg p-4 mb-6">
                <p className="text-sm text-red-800 font-medium">Reason:</p>
                <p className="text-sm text-red-700">
                  {customerData.suspensionReason}
                </p>
              </div>
            )}
            <button
              onClick={() => setShowUnsuspendModal(true)}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Request Unsuspend
            </button>
          </div>
        </div>

        {/* Unsuspend Request Modal */}
        <SimpleUnsuspendModal
          isOpen={showUnsuspendModal}
          onClose={() => setShowUnsuspendModal(false)}
          customerAddress={account?.address || ""}
          onSuccess={() => {
            setShowUnsuspendModal(false);
            // Optionally refresh customer data
            fetchCustomerData();
          }}
        />
      </>
    );
  }

  return (
    <DashboardLayout
      userRole="customer"
      activeTab={activeTab}
      onTabChange={handleTabChange}
    >
      <Toaster position="top-right" />
      <div
        className="min-h-screen py-8 bg-[#0D0D0D]"
        style={{
          backgroundImage: `url('/img/dashboard-bg.png')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Tab Content */}
          {activeTab === "overview" && (
            <OverviewTab
              customerData={customerData}
              blockchainBalance={blockchainBalance}
              earnedBalanceData={earnedBalanceData}
              transactions={transactions}
            />
          )}

          {/* Transactions Tab */}
          {activeTab === "transactions" && (
            <TransactionsTab transactions={transactions} loading={loading} />
          )}

          {/* Referrals Tab */}
          {activeTab === "referrals" && <ReferralDashboard />}

          {/* Approvals Tab */}
          {activeTab === "approvals" && <RedemptionApprovals />}

          {/* Settings Tab */}
          {activeTab === "settings" && (
            <SettingsTab
              customerData={customerData}
              onUpdateCustomer={fetchCustomerData}
            />
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
