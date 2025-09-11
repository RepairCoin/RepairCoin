"use client";

import React, { useState, useEffect } from "react";
import { useActiveAccount } from "thirdweb/react";
import { CheckCircle, XCircle, Clock, QrCode, Flame } from "lucide-react";
import { toast } from "react-hot-toast";
import { getContract, prepareContractCall, sendTransaction } from "thirdweb";
import { baseSepolia } from "thirdweb/chains";
import { createThirdwebClient } from "thirdweb";
import { QRCodeModal } from "../QRCodeModal";
import { DataTable, type Column } from "../ui/DataTable";

const client = createThirdwebClient({
  clientId:
    process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID ||
    "1969ac335e07ba13ad0f8d1a1de4f6ab",
});

const BURN_ADDRESS = "0x000000000000000000000000000000000000dEaD";

interface RedemptionSession {
  sessionId: string;
  shopId: string;
  amount: number;
  status: string;
  createdAt: string;
  expiresAt: string;
  burnTransactionHash?: string;
}

interface BurnStatus {
  [sessionId: string]: {
    burning: boolean;
    burned: boolean;
    transactionHash?: string;
  };
}

export function RedemptionApprovals() {
  const account = useActiveAccount();
  const [sessions, setSessions] = useState<RedemptionSession[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [burnStatus, setBurnStatus] = useState<BurnStatus>({});

  // For QR generation
  const [qrShopId, setQrShopId] = useState("");
  const [qrAmount, setQrAmount] = useState(0);
  const [generatedQR, setGeneratedQR] = useState<string | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);

  useEffect(() => {
    if (account?.address) {
      loadSessions();
      const interval = setInterval(loadSessions, 5000);
      return () => clearInterval(interval);
    }
  }, [account?.address]);

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

  const burnTokens = async (sessionId: string, amount: number) => {
    if (!account) {
      toast.error("Please connect your wallet");
      return;
    }

    setBurnStatus((prev) => ({
      ...prev,
      [sessionId]: { burning: true, burned: false },
    }));

    try {
      const contract = getContract({
        client,
        chain: baseSepolia,
        address:
          process.env.NEXT_PUBLIC_RCN_CONTRACT_ADDRESS ||
          process.env.NEXT_PUBLIC_REPAIRCOIN_CONTRACT_ADDRESS ||
          "0xBFE793d78B6B83859b528F191bd6F2b8555D951C",
      });

      const transaction = prepareContractCall({
        contract,
        method: "function transfer(address to, uint256 amount) returns (bool)",
        params: [BURN_ADDRESS, BigInt(amount) * BigInt(10 ** 18)],
      });

      const result = await sendTransaction({
        transaction,
        account: account,
      });

      console.log("Burn transaction sent:", result.transactionHash);

      setBurnStatus((prev) => ({
        ...prev,
        [sessionId]: {
          burning: false,
          burned: true,
          transactionHash: result.transactionHash,
        },
      }));

      toast.success(`Burned ${amount} RCN successfully!`);
      return result.transactionHash;
    } catch (error: any) {
      console.error("Error burning tokens:", error);
      setBurnStatus((prev) => ({
        ...prev,
        [sessionId]: { burning: false, burned: false },
      }));

      if (error.message?.includes("User rejected")) {
        toast.error("Transaction cancelled");
      } else if (error.message?.includes("insufficient")) {
        toast.error("Insufficient RCN balance");
      } else {
        toast.error("Failed to burn tokens");
      }
      throw error;
    }
  };

  const approveSession = async (
    sessionId: string,
    transactionHash?: string
  ) => {
    setProcessing(sessionId);

    try {
      const message = JSON.stringify({
        action: "approve_redemption",
        sessionId,
        timestamp: new Date().toISOString(),
        burnTransactionHash: transactionHash,
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
            transactionHash,
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
    if (!qrShopId || !qrAmount) {
      toast.error("Please select shop and enter amount");
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
        setShowQRModal(true);
        toast.success("QR code generated! Show this to the shop.");
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to generate QR code");
      }
    } catch (error) {
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
        const burnState = burnStatus[item.sessionId];
        const isPending = item.status === "pending";
        
        return (
          <div className="flex gap-2 items-center flex-wrap">
            {/* Burn Button - Show for pending items that haven't been burned */}
            {isPending && !burnState?.burned ? (
              <button
                onClick={() => burnTokens(item.sessionId, item.amount)}
                disabled={processing === item.sessionId || burnState?.burning}
                className="px-2 md:px-3 py-1 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs md:text-sm flex items-center gap-1 transition-all"
              >
                {burnState?.burning ? (
                  <>
                    <span className="animate-spin">⏳</span> Burning...
                  </>
                ) : (
                  <>
                    <Flame className="w-4 h-4" /> Burn
                  </>
                )}
              </button>
            ) : isPending && burnState?.burned ? (
              <span className="text-xs text-green-600 flex items-center">
                <CheckCircle className="w-3 h-3 mr-1" /> Burned
              </span>
            ) : null}

            {/* Approve Button - Show for pending items that have been burned, disabled otherwise */}
            <button
              onClick={() => isPending && burnState?.burned && approveSession(item.sessionId, burnState?.transactionHash)}
              disabled={!isPending || !burnState?.burned || processing === item.sessionId}
              className={`px-2 md:px-3 py-1 rounded-lg text-xs md:text-sm transition-all ${
                isPending && burnState?.burned
                  ? "bg-green-600 text-white hover:bg-green-700"
                  : "bg-gray-600 text-gray-400 cursor-not-allowed"
              } disabled:opacity-50`}
            >
              <CheckCircle className="w-4 h-4 inline mr-1" />
              Approve
            </button>

            {/* Reject Button - Show for all pending items, disabled for non-pending */}
            <button
              onClick={() => isPending && rejectSession(item.sessionId)}
              disabled={!isPending || processing === item.sessionId || burnState?.burning}
              className={`px-2 md:px-3 py-1 rounded-lg text-xs md:text-sm transition-all ${
                isPending
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "bg-gray-600 text-gray-400 cursor-not-allowed"
              } disabled:opacity-50`}
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
              Shop ID
            </label>
            <input
              type="text"
              value={qrShopId}
              onChange={(e) => setQrShopId(e.target.value)}
              placeholder="Enter shop ID"
              className="w-full px-4 py-3 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Amount (RCN)
            </label>
            <input
              type="number"
              min="1"
              value={qrAmount || ""}
              onChange={(e) => setQrAmount(parseInt(e.target.value) || 0)}
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

        <div className="p-4 md:p-8">
          <DataTable
            data={sessions}
            columns={redemptionColumns}
            keyExtractor={(item) => item.sessionId}
            emptyMessage="No redemption requests"
            emptyIcon={
              <div className="text-4xl sm:text-5xl mb-3 sm:mb-4">🔄</div>
            }
            loading={loading}
            className="text-white"
            headerClassName="bg-gray-800/50"
            rowClassName={(item) => 
              item.status === "pending" 
                ? "bg-yellow-900/20 hover:bg-yellow-900/30" 
                : "bg-gray-800/30 hover:bg-gray-800/40"
            }
          />
        </div>
      </div>

      {/* QR Code Modal */}
      {generatedQR && (
        <QRCodeModal
          isOpen={showQRModal}
          onClose={() => setShowQRModal(false)}
          qrData={generatedQR}
          title="Redemption QR Code"
          description={`Redeem ${qrAmount} RCN at ${qrShopId}`}
        />
      )}
    </div>
  );
}