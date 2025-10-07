"use client";

import React, { useState, useEffect } from "react";
import { useActiveAccount, useSendTransaction } from "thirdweb/react";
import { CheckCircle, XCircle, Clock, Info } from "lucide-react";
import { toast } from "react-hot-toast";
import { DataTable, type Column } from "../ui/DataTable";
import { DashboardHeader } from "../ui/DashboardHeader";
import { useCustomer } from "@/hooks/useCustomer";
import { createThirdwebClient, getContract, prepareContractCall } from "thirdweb";
import { baseSepolia } from "thirdweb/chains";

interface RedemptionSession {
  sessionId: string;
  shopId: string;
  amount: number;
  status: string;
  createdAt: string;
  expiresAt: string;
}

export function RedemptionApprovals() {
  const account = useActiveAccount();
  const { balanceData } = useCustomer();
  const [sessions, setSessions] = useState<RedemptionSession[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  const [sessionId, setSessionId] = useState<string | null>(null);
  
  // Shop list for dropdown
  const [shops, setShops] = useState<Array<{shopId: string; name: string; verified: boolean}>>([]);
  const [loadingShops, setLoadingShops] = useState(true);
  
  // For showing approved session QR
  const [selectedApprovedSession, setSelectedApprovedSession] = useState<RedemptionSession | null>(null);
  
  // Thirdweb setup for contract interactions
  const client = createThirdwebClient({
    clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "1969ac335e07ba13ad0f8d1a1de4f6ab",
  });
  
  const contract = getContract({
    client,
    chain: baseSepolia,
    address: (process.env.NEXT_PUBLIC_RCN_CONTRACT_ADDRESS ||
      process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
      "0xBFE793d78B6B83859b528F191bd6F2b8555D951C") as `0x${string}`,
  });
  
  const { mutate: sendTransaction } = useSendTransaction();
  
  // Admin wallet address for token approval
  const ADMIN_WALLET = "0x761E5E59485ec6feb263320f5d636042bD9EBc8c";

  useEffect(() => {
    if (account?.address) {
      loadSessions();
      loadShops();
      const interval = setInterval(loadSessions, 5000);
      return () => clearInterval(interval);
    }
  }, [account?.address]);

  const loadShops = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/customers/shops`);
      if (response.ok) {
        const result = await response.json();
        // Filter for active and verified shops only
        const activeShops = result.data.shops.filter(
          (shop: any) => shop.active && shop.verified
        );
        setShops(activeShops);
      }
    } catch (error) {
      console.error("Error loading shops:", error);
    } finally {
      setLoadingShops(false);
    }
  };

  const loadSessions = async () => {
    if (!account?.address) return;

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/tokens/redemption-session/my-sessions`,
        {
          headers: {
            Authorization: `Bearer ${
              localStorage.getItem("customerAuthToken") || ""
            }`,
          },
        }
      );

      if (response.ok) {
        const result = await response.json();
        setSessions(result.data.sessions);
        setPendingCount(result.data.pendingCount);
      } else {
        console.error("Failed to load sessions:", response.status);
        if (response.status === 401) {
          console.error(
            "Customer not authenticated - token may be missing or invalid"
          );
        }
      }
    } catch (error) {
      console.error("Error loading sessions:", error);
    } finally {
      setLoading(false);
    }
  };


  const approveSession = async (sessionId: string) => {
    setProcessing(sessionId);

    try {
      // Find the session to get the amount
      const session = sessions.find(s => s.sessionId === sessionId);
      if (!session) {
        toast.error("Session not found");
        return;
      }

      const amount = session.amount;
      const amountInWei = BigInt(amount * 10 ** 18);

      toast.loading("Step 1: Approving token spending...", { id: "approval-process" });

      // Step 1: Approve the admin wallet to spend customer's tokens
      const approvalTx = prepareContractCall({
        contract,
        method: "function approve(address spender, uint256 amount) returns (bool)",
        params: [ADMIN_WALLET, amountInWei],
      });

      console.log("Prepared approval transaction:", {
        contract: contract.address,
        spender: ADMIN_WALLET,
        amount: amount,
        amountInWei: amountInWei.toString(),
      });

      // Wait for customer to approve the transaction
      await new Promise((resolve, reject) => {
        sendTransaction(approvalTx, {
          onSuccess: (result) => {
            console.log("Approval transaction successful:", result.transactionHash);
            toast.loading("Step 2: Processing redemption...", { id: "approval-process" });
            resolve(result);
          },
          onError: (error) => {
            console.error("Approval transaction failed:", error);
            toast.error("Token approval cancelled or failed", { id: "approval-process" });
            reject(error);
          },
        });
      });

      // Step 2: Proceed with backend redemption approval
      const message = JSON.stringify({
        action: "approve_redemption",
        sessionId,
        timestamp: new Date().toISOString,
      });

      const signature = `0x${Buffer.from(message).toString("hex")}`;

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/tokens/redemption-session/approve`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${
              localStorage.getItem("customerAuthToken") || ""
            }`,
          },
          body: JSON.stringify({
            sessionId,
            signature,
          }),
        }
      );

      if (response.ok) {
        toast.success("Redemption completed! Tokens have been burned from your wallet.", { 
          id: "approval-process",
          duration: 4000 
        });
        await loadSessions();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to complete redemption", { id: "approval-process" });
      }
    } catch (error) {
      console.error("Approval process error:", error);
      toast.error("Failed to complete redemption process", { id: "approval-process" });
    } finally {
      setProcessing(null);
    }
  };

  const rejectSession = async (sessionId: string) => {
    setProcessing(sessionId);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/tokens/redemption-session/reject`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${
              localStorage.getItem("customerAuthToken") || ""
            }`,
          },
          body: JSON.stringify({ sessionId }),
        }
      );

      if (response.ok) {
        toast.success("Redemption rejected");
        await loadSessions();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to reject redemption");
      }
    } catch (error) {
      toast.error("Failed to reject redemption");
    } finally {
      setProcessing(null);
    }
  };


  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date().getTime();
    const expiry = new Date(expiresAt).getTime();
    const diff = expiry - now;

    if (diff <= 0) return "Expired";

    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  // Define columns for the DataTable
  const redemptionColumns: Column<RedemptionSession>[] = [
    {
      key: "amount",
      header: "Amount",
      accessor: (item) => (
        <span className="text-[#FFCC00] font-semibold">{item.amount} RCN</span>
      ),
      sortable: true,
    },
    {
      key: "shop",
      header: "Shop",
      accessor: (item) => <span className="text-gray-100">{item.shopId}</span>,
    },
    {
      key: "requested",
      header: "Requested",
      accessor: (item) => (
        <span className="text-gray-400 text-xs">
          {new Date(item.createdAt).toLocaleString('en-US', { timeZone: 'America/Chicago' })}
        </span>
      ),
      sortable: true,
    },
    {
      key: "status",
      header: "Status",
      accessor: (item) => {
        if (item.status === "pending") {
          return (
            <div className="flex flex-col">
              <span className="text-yellow-400 text-xs font-semibold">Pending</span>
              <span className="text-yellow-400 text-xs">
                Expires in: {getTimeRemaining(item.expiresAt)}
              </span>
            </div>
          );
        } else if (item.status === "approved") {
          return (
            <div className="flex items-center gap-1">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-green-500 text-xs">Approved</span>
            </div>
          );
        } else if (item.status === "rejected") {
          return (
            <div className="flex items-center gap-1">
              <XCircle className="w-4 h-4 text-red-500" />
              <span className="text-red-500 text-xs">Rejected</span>
            </div>
          );
        } else if (item.status === "used") {
          return <span className="text-gray-500 text-xs">Completed</span>;
        }
        return <span className="text-gray-500 text-xs">{item.status}</span>;
      },
    },
    {
      key: "actions",
      header: "Actions",
      accessor: (item) => {
        const isPending = item.status === "pending";
        
        return (
          <div className="flex gap-2 items-center flex-wrap">
            {/* Approve Button */}
            <button
              onClick={() => isPending && approveSession(item.sessionId)}
              disabled={!isPending || processing === item.sessionId}
              className={`px-2 md:px-3 py-1 rounded-lg text-xs md:text-sm transition-all ${
                isPending
                  ? "bg-green-600 text-white hover:bg-green-700"
                  : "bg-gray-600 text-gray-400 cursor-not-allowed"
              } disabled:opacity-50`}
              title="Approve redemption for shop to process"
            >
              <CheckCircle className="w-4 h-4 inline mr-1" />
              Approve
            </button>

            {/* Reject Button */}
            <button
              onClick={() => isPending && rejectSession(item.sessionId)}
              disabled={!isPending || processing === item.sessionId}
              className={`px-2 md:px-3 py-1 rounded-lg text-xs md:text-sm transition-all ${
                isPending
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "bg-gray-600 text-gray-400 cursor-not-allowed"
              } disabled:opacity-50`}
              title="Decline this redemption request"
            >
              <XCircle className="w-4 h-4 inline mr-1" />
              Reject
            </button>
            
          </div>
        );
      },
    },
  ];

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-4">
            <div className="h-24 bg-gray-200 rounded"></div>
            <div className="h-24 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with gradient background */}
      <DashboardHeader
        title="Redemption Approvals"
        subtitle="Approve or reject redemption requests"
      />

      {/* Info Alert About Off-Chain Tokens */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start">
          <div className="text-blue-600 mr-3">ℹ️</div>
          <div className="flex-1">
            <p className="text-sm text-blue-800">
              <strong>How RepairCoin Works:</strong> Your RCN tokens are tracked securely in our system. 
              When you approve a redemption, the shop can process your request and provide the service. 
              Tokens are not stored in your crypto wallet.
            </p>
          </div>
        </div>
      </div>
      {/* Pending Approvals Alert */}
      {pendingCount > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <div className="flex items-center">
            <Clock className="w-5 h-5 text-yellow-600 mr-3" />
            <p className="text-sm md:text-base text-yellow-800 font-medium">
              You have {pendingCount} pending redemption request
              {pendingCount > 1 ? "s" : ""}
            </p>
          </div>
        </div>
      )}

      {/* Balance Info */}
      {balanceData && (
        <div className="bg-[#212121] border border-gray-700 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-gray-300">
              <p className="font-semibold text-white mb-1">Available Balance: {balanceData.availableBalance} RCN</p>
              <p>You can redeem your full RCN balance at any participating shop (earned from repairs or received from others).</p>
            </div>
          </div>
        </div>
      )}


      {/* Redemption Sessions Table */}
      <div className="bg-[#212121] rounded-xl md:rounded-2xl lg:rounded-3xl overflow-hidden">
        <div
          className="w-full px-4 md:px-6 lg:px-8 py-3 md:py-4 text-white rounded-t-xl md:rounded-t-2xl lg:rounded-t-3xl"
          style={{
            backgroundImage: `url('/img/cust-ref-widget3.png')`,
            backgroundSize: "cover",
            backgroundPosition: "right",
            backgroundRepeat: "no-repeat",
          }}
        >
          <p className="text-base sm:text-lg md:text-xl text-gray-900 font-semibold">
            Redemption Requests
          </p>
        </div>

        <div className="bg-[#212121] py-4 md:py-8">
          <DataTable
            data={sessions}
            columns={redemptionColumns}
            keyExtractor={(item) => item.sessionId}
            emptyMessage="No redemption requests"
            emptyIcon={
              <div className="text-4xl sm:text-5xl mb-3 sm:mb-4">🔄</div>
            }
            headerClassName="bg-gray-900/60 border-gray-800"
            showPagination={true}
            itemsPerPage={10}
            loading={loading}
            className="text-white"
          />
        </div>
      </div>

    </div>
  );
}