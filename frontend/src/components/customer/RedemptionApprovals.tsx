"use client";

import React, { useState, useEffect } from "react";
import { useActiveAccount } from "thirdweb/react";
import { CheckCircle, XCircle, Clock, QrCode, Info } from "lucide-react";
import { toast } from "react-hot-toast";
import { QRCodeModal } from "../QRCodeModal";
import { DataTable, type Column } from "../ui/DataTable";
import { DashboardHeader } from "../ui/DashboardHeader";
import { useCustomer } from "@/hooks/useCustomer";

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
  const { earnedBalanceData } = useCustomer();
  const [sessions, setSessions] = useState<RedemptionSession[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  // For QR generation
  const [qrShopId, setQrShopId] = useState("");
  const [qrAmount, setQrAmount] = useState(0);
  const [generatedQR, setGeneratedQR] = useState<string | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  
  // Shop list for dropdown
  const [shops, setShops] = useState<Array<{shopId: string; name: string; verified: boolean}>>([]);
  const [loadingShops, setLoadingShops] = useState(true);
  
  // For showing approved session QR
  const [selectedApprovedSession, setSelectedApprovedSession] = useState<RedemptionSession | null>(null);

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
      const message = JSON.stringify({
        action: "approve_redemption",
        sessionId,
        timestamp: new Date().toISOString(),
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
        toast.success("Redemption approved successfully");
        await loadSessions();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to approve redemption");
      }
    } catch (error) {
      toast.error("Failed to approve redemption");
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

  const generateQRCode = async () => {
    if (!qrShopId || !qrAmount || qrAmount < 1) {
      toast.error("Please select shop and enter a valid amount (minimum 1 RCN)");
      return;
    }

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/tokens/redemption-session/generate-qr`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${
              localStorage.getItem("customerAuthToken") || ""
            }`,
          },
          body: JSON.stringify({
            shopId: qrShopId,
            amount: qrAmount,
          }),
        }
      );

      if (response.ok) {
        const result = await response.json();
        setGeneratedQR(result.data.qrCode);
        
        // Extract session ID from the QR code data
        try {
          const qrDataParsed = JSON.parse(result.data.qrCode);
          setSessionId(qrDataParsed.sessionId);
        } catch (e) {
          console.log("Could not extract session ID from QR data");
        }
        
        setShowQRModal(true);
        toast.success("QR code generated! Show this to the shop.");
      } else {
        const error = await response.json();
        console.error("QR generation error:", error);
        toast.error(error.error || `Failed to generate QR code (${response.status})`);
      }
    } catch (error) {
      console.error("QR generation error:", error);
      toast.error("Failed to generate QR code");
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
          {new Date(item.createdAt).toLocaleString()}
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
            
            {/* Show QR Button for Approved Sessions */}
            {item.status === "approved" && (
              <button
                onClick={() => {
                  // Create QR data for the approved session
                  const qrData = JSON.stringify({
                    sessionId: item.sessionId,
                    amount: item.amount,
                    shopId: item.shopId,
                    customerAddress: account?.address,
                    type: 'redemption_approved'
                  });
                  setGeneratedQR(qrData);
                  setSelectedApprovedSession(item);
                  setShowQRModal(true);
                }}
                className="px-2 md:px-3 py-1 bg-[#FFCC00] text-black hover:bg-[#FFD700] rounded-lg text-xs md:text-sm transition-all flex items-center gap-1"
              >
                <QrCode className="w-4 h-4" />
                Show QR
              </button>
            )}
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
      {earnedBalanceData && (
        <div className="bg-[#212121] border border-gray-700 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-gray-300">
              <p className="font-semibold text-white mb-1">Available Balance: {earnedBalanceData.earnedBalance} RCN</p>
              <p>You can only approve redemptions up to your available balance. Each shop has per-transaction limits based on your tier.</p>
            </div>
          </div>
        </div>
      )}

      {/* QR Generator */}
      <div
        className="bg-[#212121] rounded-xl md:rounded-2xl lg:rounded-3xl overflow-hidden"
        style={{
          backgroundImage: `url('/img/cus-approval-1.png')`,
          backgroundSize: "cover",
          backgroundPosition: "right",
          backgroundRepeat: "no-repeat",
        }}
      >
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
            Generate Redemption QR Code
          </p>
        </div>
        <div className="flex flex-col w-2/3 p-4 md:p-8 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Select Shop
            </label>
            {loadingShops ? (
              <div className="w-full px-4 py-3 border border-gray-300 bg-[#2F2F2F] text-gray-400 rounded-xl">
                Loading shops...
              </div>
            ) : (
              <select
                value={qrShopId}
                onChange={(e) => setQrShopId(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select a shop</option>
                {shops.map((shop) => (
                  <option key={shop.shopId} value={shop.shopId}>
                    {shop.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Amount (RCN)
            </label>
            <input
              type="number"
              min="1"
              value={qrAmount || ""}
              onChange={(e) => {
                const value = parseInt(e.target.value);
                setQrAmount(isNaN(value) ? 0 : Math.max(0, value));
              }}
              placeholder="Enter amount"
              className="w-full px-4 py-3 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <button
            onClick={generateQRCode}
            className="w-full flex items-center justify-center gap-2 bg-[#FFCC00] text-black py-2 rounded-lg transition mt-10"
          >
            <QrCode className="w-5 h-5" />
            Generate QR Code
          </button>
        </div>
      </div>

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

      {/* QR Code Modal */}
      {generatedQR && (
        <QRCodeModal
          isOpen={showQRModal}
          onClose={() => {
            setShowQRModal(false);
            setSelectedApprovedSession(null);
            setSessionId(null);
          }}
          qrData={generatedQR}
          title={selectedApprovedSession ? "Approved Redemption QR" : "Redemption QR Code"}
          description={
            selectedApprovedSession 
              ? `Show this QR to redeem ${selectedApprovedSession.amount} RCN at ${selectedApprovedSession.shopId}`
              : `Redeem ${qrAmount} RCN at ${shops.find(s => s.shopId === qrShopId)?.name || qrShopId}`
          }
          shareableLink={sessionId ? `${window.location.origin}/redeem/${sessionId}` : undefined}
        />
      )}
    </div>
  );
}