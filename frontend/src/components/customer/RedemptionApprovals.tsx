"use client";

import React, { useState, useEffect } from "react";
import { useActiveAccount } from "thirdweb/react";
import { CheckCircle, XCircle, Clock, Info, QrCode, Download, X, Check } from "lucide-react";
import { toast } from "react-hot-toast";
import { DataTable, type Column } from "../ui/DataTable";
import { DashboardHeader } from "../ui/DashboardHeader";
import { useCustomer } from "@/hooks/useCustomer";
import QRCode from "qrcode";
import Tooltip from "../ui/tooltip";

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
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrCodeData, setQrCodeData] = useState("");

  const [sessionId, setSessionId] = useState<string | null>(null);
  
  // Shop list for dropdown
  const [shops, setShops] = useState<Array<{shopId: string; name: string; verified: boolean}>>([]);
  const [loadingShops, setLoadingShops] = useState(true);
  
  // For showing approved session QR
  const [selectedApprovedSession, setSelectedApprovedSession] = useState<RedemptionSession | null>(null);

  const generateQRCode = async () => {
    if (!account?.address) {
      toast.error("No wallet address found");
      return;
    }

    try {
      const qrData = await QRCode.toDataURL(account.address, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      setQrCodeData(qrData);
      setShowQRModal(true);
    } catch (error) {
      console.error("Error generating QR code:", error);
      toast.error("Failed to generate QR code");
    }
  };

  const downloadQRCode = () => {
    if (!qrCodeData) return;
    
    const link = document.createElement('a');
    link.download = `wallet-qr-${account?.address?.slice(0, 6)}.png`;
    link.href = qrCodeData;
    link.click();
    toast.success("QR code downloaded!");
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

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

      toast.loading("Processing redemption approval...", { id: "approval-process" });

      // Offchain redemption approval - no blockchain transaction needed
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
        toast.success("Redemption approved! Your balance has been updated.", { 
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
          return     <div className="flex items-center gap-1">
              <Check className="w-4 h-4 text-green-500" />
              <span className="text-green-500 text-xs">Completed</span>
            </div>
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

      {/* QR Code for Shop Scanning */}
      <div className="bg-[#212121] rounded-xl sm:rounded-2xl lg:rounded-3xl">
        <div
          className="w-full flex justify-between items-center px-4 sm:px-6 lg:px-8 py-3 sm:py-4 text-white rounded-t-xl sm:rounded-t-2xl lg:rounded-t-3xl overflow-visible relative"
          style={{
            backgroundImage: `url('/img/cust-ref-widget3.png')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        >
          <p className="text-base sm:text-lg md:text-xl text-gray-900 font-semibold">
            QR Code for Shop Redemption
          </p>
          <Tooltip
            title="How it works"
            position="bottom"
            className="right-0"
            content={
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-blue-400">
                      1
                    </span>
                  </div>
                  <span className="text-gray-300">
                    Generate your personal QR code containing your wallet address
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-blue-400">
                      2
                    </span>
                  </div>
                  <span className="text-gray-300">
                    Show the QR code to the shop cashier when you want to redeem
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-blue-400">
                      3
                    </span>
                  </div>
                  <span className="text-gray-300">
                    Shop scans your QR code for instant wallet address lookup
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-blue-400">
                      4
                    </span>
                  </div>
                  <span className="text-gray-300">
                    Approve the redemption request on your device to complete
                  </span>
                </li>
              </ul>
            }
          />
        </div>
        <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
          <div className="text-center">
            <QrCode className="w-16 h-16 mx-auto mb-4 text-[#FFCC00]" />
            <p className="text-gray-300 text-sm sm:text-base mb-6">
              Show this QR code to the shop for faster redemption. It contains your wallet address for easy lookup.
            </p>
            <button
              onClick={generateQRCode}
              className="px-6 py-3 bg-[#FFCC00] text-black rounded-3xl font-medium hover:bg-yellow-500 transition-colors"
            >
              Generate QR Code
            </button>
          </div>
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
      {showQRModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#212121] rounded-2xl max-w-md w-full mx-4">
            <div className="flex justify-between items-center p-6 border-b border-gray-700">
              <h3 className="text-xl font-semibold text-white">Wallet Address QR Code</h3>
              <button
                onClick={() => setShowQRModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 text-center">
              {qrCodeData && (
                <div className="space-y-4">
                  <img 
                    src={qrCodeData} 
                    alt="Wallet Address QR Code" 
                    className="mx-auto bg-white p-4 rounded-lg"
                  />
                  
                  <div className="text-sm text-gray-300 break-all bg-[#2F2F2F] p-3 rounded-lg">
                    {account?.address}
                  </div>
                  
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={() => copyToClipboard(account?.address || "", "Wallet address")}
                      className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                    >
                      Copy Address
                    </button>
                    <button
                      onClick={downloadQRCode}
                      className="px-4 py-2 bg-[#FFCC00] text-black rounded-lg hover:bg-yellow-500 transition-colors flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Download QR
                    </button>
                  </div>
                  
                  <p className="text-xs text-gray-400 mt-4">
                    Show this QR code to shops for instant wallet address lookup during redemption
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}