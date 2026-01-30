"use client";

import React, { useState, useEffect } from "react";
import { useActiveAccount, useActiveWallet } from "thirdweb/react";
import { CheckCircle, XCircle, Clock, QrCode, Download, X, Check, Loader2, RefreshCw, ShieldCheck, Home, ChevronRight, Wallet, Hourglass } from "lucide-react";
import { toast } from "react-hot-toast";
import { DataTable, type Column } from "../ui/DataTable";
import { useCustomer } from "@/hooks/useCustomer";
import QRCode from "qrcode";
import Tooltip from "../ui/tooltip";
import apiClient from '@/services/api/client';
import { useAuthStore } from "@/stores/authStore";
import { useCustomerStore } from "@/stores/customerStore";
import { SuspendedActionModal } from "./SuspendedActionModal";

interface RedemptionSession {
  sessionId: string;
  shopId: string;
  shopName?: string;
  shopLocation?: string;
  maxAmount: number;
  customerAddress?: string;
  status: string;
  createdAt: string;
  expiresAt: string;
  method?: string;
}

export function RedemptionApprovals() {
  const account = useActiveAccount();
  const wallet = useActiveWallet();
  const { userProfile } = useAuthStore();
  const { balanceData, fetchCustomerData } = useCustomer();
  const [sessions, setSessions] = useState<RedemptionSession[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrCodeData, setQrCodeData] = useState("");
  const [showSuspendedModal, setShowSuspendedModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [sessionId, setSessionId] = useState<string | null>(null);

  // Check if user is suspended
  const isSuspended = userProfile?.suspended || false;

  // Shop list for dropdown
  const [shops, setShops] = useState<Array<{shopId: string; name: string; verified: boolean}>>([]);
  const [loadingShops, setLoadingShops] = useState(true);

  // For showing approved session QR
  const [selectedApprovedSession, setSelectedApprovedSession] = useState<RedemptionSession | null>(null);

  // Check if using embedded wallet (social login: Google, Email, Apple)
  const isEmbeddedWallet = wallet?.id === 'inApp' || wallet?.id === 'embedded' || wallet?.id?.includes('inApp');

  // Derived data
  const pendingSessions = sessions.filter(s => s.status === "pending");
  const completedSessions = sessions.filter(s => s.status === "used" || s.status === "approved" || s.status === "rejected");

  const generateQRCode = async () => {
    if (isSuspended) {
      setShowSuspendedModal(true);
      return;
    }

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

  const createSignatureMessage = (session: RedemptionSession): string => {
    return `RepairCoin Redemption Request

Session ID: ${session.sessionId}
Customer: ${session.customerAddress || account?.address}
Shop: ${session.shopId}
Amount: ${session.maxAmount} RCN
Expires: ${new Date(session.expiresAt).toISOString()}

By signing this message, I approve the redemption of ${session.maxAmount} RCN tokens at the specified shop.`;
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
      const result = await apiClient.get('/tokens/redemption-session/my-sessions');
      setSessions(result.sessions || []);
      setPendingCount(result.pendingCount || 0);
    } catch (error) {
      console.error("Error loading sessions:", error);
      setSessions([]);
      setPendingCount(0);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadSessions();
    await fetchCustomerData(true);
    setRefreshing(false);
    toast.success("Data refreshed");
  };

  const approveSession = async (sessionId: string) => {
    if (!wallet || !account?.address) {
      toast.error("Please ensure your wallet is connected");
      return;
    }

    setProcessing(sessionId);

    try {
      const session = sessions.find(s => s.sessionId === sessionId);
      if (!session) {
        toast.error("Session not found");
        return;
      }

      if (isEmbeddedWallet) {
        toast.loading("Processing approval...", { id: "approval-process" });
      } else {
        toast.loading("Please sign the message in your wallet...", { id: "approval-process" });
      }

      const message = createSignatureMessage(session);

      let signature: string;
      try {
        if (!account) {
          throw new Error("No account connected");
        }
        signature = await account.signMessage({ message });
      } catch (signError) {
        console.error("Signature error:", signError);
        toast.error("Signature was cancelled or failed. Please try again.", { id: "approval-process" });
        return;
      }

      toast.loading("Processing redemption approval...", { id: "approval-process" });

      await apiClient.post(
        '/tokens/redemption-session/approve',
        {
          sessionId,
          signature,
        }
      );

      toast.success("Redemption approved! Shop is processing your request...", {
        id: "approval-process",
        duration: 4000
      });

      await loadSessions();

      const initialBalance = balanceData?.availableBalance || 0;
      let attempts = 0;
      const maxAttempts = 10;

      const pollForBalanceUpdate = async () => {
        attempts++;
        await fetchCustomerData(true);

        const newBalance = useCustomerStore.getState().balanceData?.availableBalance || 0;
        if (newBalance !== initialBalance || attempts >= maxAttempts) {
          if (newBalance !== initialBalance) {
            toast.success(`Balance updated: ${newBalance} RCN`, { duration: 3000 });
          }
          return;
        }

        setTimeout(pollForBalanceUpdate, 1000);
      };

      setTimeout(pollForBalanceUpdate, 1500);
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
      await apiClient.post(
        '/tokens/redemption-session/reject',
        { sessionId }
      );

      toast.success("Redemption rejected");
      await loadSessions();
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

  // Columns for Redemption Requests table
  const requestColumns: Column<RedemptionSession>[] = [
    {
      key: "amount",
      header: "AMOUNT",
      accessor: (item) => (
        <span className="text-[#FFCC00] font-bold">{item.maxAmount} RCN</span>
      ),
      sortable: true,
    },
    {
      key: "shop",
      header: "SHOP NAME",
      accessor: (item) => <span className="text-gray-100">{item.shopName || item.shopId}</span>,
    },
    {
      key: "requested",
      header: "REQUESTED",
      accessor: (item) => (
        <span className="text-gray-400 text-sm">
          {new Date(item.createdAt).toLocaleString('en-US', {
            timeZone: 'America/Chicago',
            month: '2-digit',
            day: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })}
        </span>
      ),
      sortable: true,
    },
    {
      key: "status",
      header: "STATUS",
      accessor: (item) => {
        if (item.status === "pending") {
          return (
            <div className="flex flex-col gap-0.5">
              <span className="inline-flex items-center gap-1 bg-yellow-500/20 text-yellow-400 text-xs font-bold px-2 py-0.5 rounded">
                <Hourglass className="w-3 h-3" />
                PENDING
              </span>
              <span className="text-yellow-500 text-xs font-medium">
                Expires In: {getTimeRemaining(item.expiresAt)}
              </span>
            </div>
          );
        } else if (item.status === "approved") {
          return (
            <div className="flex items-center gap-1">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-green-500 text-xs font-semibold">Approved</span>
            </div>
          );
        } else if (item.status === "rejected") {
          return (
            <div className="flex items-center gap-1">
              <XCircle className="w-4 h-4 text-red-500" />
              <span className="text-red-500 text-xs font-semibold">Rejected</span>
            </div>
          );
        } else if (item.status === "used") {
          return (
            <div className="flex items-center gap-1">
              <Check className="w-4 h-4 text-green-500" />
              <span className="text-green-500 text-xs font-semibold">Completed</span>
            </div>
          );
        }
        return <span className="text-gray-500 text-xs">{item.status}</span>;
      },
    },
    {
      key: "actions",
      header: "ACTION",
      accessor: (item) => {
        const isPending = item.status === "pending";

        return (
          <div className="flex gap-2 items-center">
            <button
              onClick={() => isPending && approveSession(item.sessionId)}
              disabled={!isPending || processing === item.sessionId}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                isPending
                  ? "bg-green-600 text-white hover:bg-green-700"
                  : "bg-gray-700 text-gray-500 cursor-not-allowed"
              } disabled:opacity-50`}
            >
              <CheckCircle className="w-3.5 h-3.5" />
              Approve
            </button>

            <button
              onClick={() => isPending && rejectSession(item.sessionId)}
              disabled={!isPending || processing === item.sessionId}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                isPending
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "bg-gray-700 text-gray-500 cursor-not-allowed"
              } disabled:opacity-50`}
            >
              <XCircle className="w-3.5 h-3.5" />
              Reject
            </button>
          </div>
        );
      },
    },
  ];

  // Columns for Redemption History table
  const historyColumns: Column<RedemptionSession>[] = [
    {
      key: "date",
      header: "DATE",
      accessor: (item) => (
        <span className="text-gray-300 text-sm">
          {new Date(item.createdAt).toLocaleString('en-US', {
            timeZone: 'America/Chicago',
            month: '2-digit',
            day: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })}
        </span>
      ),
      sortable: true,
    },
    {
      key: "shop",
      header: "SHOP NAME",
      accessor: (item) => <span className="text-gray-100 font-medium">{item.shopName || item.shopId}</span>,
    },
    {
      key: "location",
      header: "LOCATION",
      accessor: (item) => <span className="text-gray-400 text-sm">{item.shopLocation || "—"}</span>,
    },
    {
      key: "method",
      header: "METHOD",
      accessor: (item) => <span className="text-gray-300 text-sm uppercase">{item.method || "QR"}</span>,
    },
    {
      key: "amount",
      header: "AMOUNT",
      accessor: (item) => (
        <span className="text-green-400 font-bold">{item.maxAmount} RCN</span>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#FFCC00]" />
        <span className="ml-3 text-gray-400">Loading approvals...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb Header */}
      <div>
        <div className="flex items-center gap-2 text-sm mb-1">
          <Home className="w-4 h-4 text-gray-400" />
          <ChevronRight className="w-3 h-3 text-gray-600" />
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[#FFCC00]" />
            <span className="text-[#FFCC00] font-semibold">Approvals</span>
          </div>
        </div>
        <p className="text-gray-400 text-sm mt-1">
          Approve or reject redemption requests from partner shops and manage how your RCN tokens are used.
        </p>
      </div>

      {/* Top Cards Row: QR Code + Available Balance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Generate QR Code Card */}
        <div className="lg:col-span-2 bg-[#1a1a1a] border border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-[#FFCC00]" />
              <h3 className="text-[#FFCC00] font-semibold text-lg">Generate QR Code</h3>
            </div>
            <Tooltip
              title="How it works"
              position="bottom"
              className="right-0"
              content={
                <ul className="space-y-3 text-sm">
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-blue-400">1</span>
                    </div>
                    <span className="text-gray-300">Generate your personal QR code containing your wallet address</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-blue-400">2</span>
                    </div>
                    <span className="text-gray-300">Show the QR code to the shop cashier when you want to redeem</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-blue-400">3</span>
                    </div>
                    <span className="text-gray-300">Shop scans your QR code for instant wallet address lookup</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-blue-400">4</span>
                    </div>
                    <span className="text-gray-300">Approve the redemption request on your device to complete</span>
                  </li>
                </ul>
              }
            />
          </div>
          <p className="text-gray-400 text-sm mb-6 text-center">
            Show this QR code to the shop for faster redemption.
            <br />
            It contains your wallet address for easy lookup.
          </p>
          <div className="text-center">
            <button
              onClick={generateQRCode}
              className="px-8 py-3 bg-[#FFCC00] text-black rounded-full font-semibold hover:bg-yellow-500 transition-colors"
            >
              Generate Your QR Code
            </button>
          </div>
        </div>

        {/* Available Balance Card */}
        <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl overflow-hidden">
          <div className="bg-[#FFCC00]/10 border-b border-[#FFCC00]/20 px-6 py-3">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-[#FFCC00]" />
              <span className="text-[#FFCC00] font-semibold text-sm">Available Balance</span>
            </div>
          </div>
          <div className="p-6 text-center">
            <p className="text-4xl font-bold text-white mb-3">
              {balanceData?.availableBalance || 0} RCN
            </p>
            <p className="text-gray-500 text-xs leading-relaxed">
              Your can redeem your full RCN balance at any participating shop.
              <br />
              (Earned from repairs or received from others)
            </p>
          </div>
        </div>
      </div>

      {/* Redemption Requests Section */}
      <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#FFCC00]" />
            <h3 className="text-[#FFCC00] font-semibold text-lg">Redemption Requests</h3>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-[#212121] border border-gray-700 rounded-lg text-sm text-gray-300 hover:bg-[#2a2a2a] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="py-2">
          <DataTable
            data={pendingSessions}
            columns={requestColumns}
            keyExtractor={(item) => item.sessionId}
            emptyMessage="No redemption requests"
            emptyIcon={
              <div className="text-4xl sm:text-5xl mb-3 sm:mb-4">🔄</div>
            }
            headerClassName="bg-[#161616] border-gray-800"
            rowClassName={(item) =>
              item.status === "pending"
                ? "border-l-2 border-l-[#FFCC00] bg-[#FFCC00]/5"
                : ""
            }
            showPagination={true}
            itemsPerPage={10}
            loading={loading}
            className="text-white"
          />
        </div>
      </div>

      {/* Redemption History Section */}
      <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-5 h-5 text-[#FFCC00]" />
            <h3 className="text-[#FFCC00] font-semibold text-lg">Redemption History</h3>
          </div>
          <p className="text-gray-500 text-sm">
            See your past redemptions across all RepairCoin partner shops.
          </p>
        </div>

        <div className="py-2">
          <DataTable
            data={completedSessions}
            columns={historyColumns}
            keyExtractor={(item) => item.sessionId}
            emptyMessage="No redemption history yet"
            emptyIcon={
              <div className="text-4xl sm:text-5xl mb-3 sm:mb-4">📋</div>
            }
            headerClassName="bg-[#161616] border-gray-800"
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

      {/* Suspended Action Modal */}
      <SuspendedActionModal
        isOpen={showSuspendedModal}
        onClose={() => setShowSuspendedModal(false)}
        action="generate redemption QR code"
        reason={userProfile?.suspensionReason}
      />
    </div>
  );
}
